"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createCoberturaFolders,
  createResumableUpdate,
  createResumableUpload,
  deleteDriveFile,
  driveViewLink,
  getDriveConfig,
  makeDriveFilePublic,
  moveDriveFile,
  renameDriveFile,
  uploadBufferToFolder,
} from "@/lib/google-drive";
import { logActivity } from "@/lib/activity";
import { construirBrief } from "@/lib/cobertura-brief";
import { TIPOS_CONTENIDO, type TipoContenido } from "@/lib/media-kind";
import { miniaturaSrc, type PiezaConMiniatura } from "@/lib/miniatura";
import { type ActionResult } from "./types";

export type Fase = "crudo" | "editado" | "aprobado";

const FASES: Fase[] = ["crudo", "editado", "aprobado"];

const FASE_LABEL: Record<Fase, string> = {
  crudo: "Contenido Crudo",
  editado: "Contenido Editado",
  aprobado: "Contenido Aprobado",
};

export interface Cobertura {
  id: string;
  nombre: string;
  descripcion: string | null;
  fecha: string | null;
  lugar: string | null;
  estado: string;
  drive_link: string | null;
  drive_folder_id: string | null;
  drive_crudo_id: string | null;
  drive_editado_id: string | null;
  drive_aprobado_id: string | null;
  // Ficha ampliada (migración 0033)
  objetivo: string | null;
  resumen: string | null;
  mensajes_clave: string | null;
  temas: string[];
  resultados: string | null;
  compromisos: string | null;
  aliados: string | null;
  publico_estimado: number | null;
  hashtags: string[];
}

export interface Asistente {
  id: string;
  cobertura_id: string;
  user_id: string | null;
  contacto_id: string | null;
  ciudadano_id: string | null;
  nombre: string;
  rol: string | null;
  organizacion: string | null;
  /** A qué título estuvo: del equipo, aliado, u otro (migración 0040). */
  vinculo: "equipo" | "aliado" | "otro";
}

/** Persona de la plataforma que se puede vincular como asistente. */
export interface PersonaVinculable {
  id: string;
  tipo: "usuario" | "contacto" | "ciudadano";
  nombre: string;
  detalle: string | null;
}

export interface CoberturaFile {
  id: string;
  cobertura_id: string;
  fase: Fase;
  nombre: string;
  url: string;
  drive_file_id: string | null;
  storage_path: string | null;
  mime: string | null;
  size: number | null;
  descripcion: string | null;
  tags: string[];
  destacado: boolean;
  orden: number;
  origen_file_id: string | null;
  version: number;
  created_at: string;
  /* ── Atribución (migración 0034) ── */
  equipo_id: string | null;
  /** Resuelto por join; null si el equipo se desactivó o se borró. */
  equipo_nombre: string | null;
  dispositivo: string | null;
  tipo_contenido: TipoContenido;
  /* ── Autoría (migración 0037) ── */
  /**
   * `created_by` es quién apretó el botón: auditoría, no se toca.
   * `responsable_id` es a quién se le acredita el material; arranca igual pero
   * se puede cambiar, porque es normal subir lo que grabó otra persona.
   */
  created_by: string | null;
  responsable_id: string | null;
  /** Resueltos desde `profiles`; null si el usuario ya no existe. */
  subido_por_nombre: string | null;
  responsable_nombre: string | null;
}

/** Metadata que la pantalla de revisión asigna a cada archivo antes de subirlo. */
export interface MetadataArchivo {
  equipo_id: string;
  tipo_contenido: TipoContenido;
  dispositivo?: string | null;
}

/**
 * Revalida en el servidor lo que mandó el cliente. La pantalla de revisión es
 * comodidad de la interfaz, no un control de acceso: quien llame directo a la
 * server action no puede saltarse esto.
 */
async function validarMetadata(
  supabase: Awaited<ReturnType<typeof createClient>>,
  meta: MetadataArchivo,
): Promise<string | null> {
  if (!TIPOS_CONTENIDO.includes(meta.tipo_contenido)) {
    return "Tipo de contenido no válido.";
  }
  const { data } = await supabase
    .from("equipos_cobertura")
    .select("id")
    .eq("id", meta.equipo_id)
    .eq("activo", true)
    .maybeSingle();
  return data ? null : "El equipo no existe o está inactivo.";
}

/** Aplana el join de equipo en la forma plana que consume la interfaz. */
function aplanarFile(
  row: Record<string, unknown>,
  nombres?: Map<string, string>,
): CoberturaFile {
  const equipo = row.equipos_cobertura as { nombre: string } | null | undefined;
  const resto = { ...row };
  delete resto.equipos_cobertura;
  const creador = (row.created_by as string | null) ?? null;
  const responsable = (row.responsable_id as string | null) ?? null;
  return {
    ...resto,
    equipo_nombre: equipo?.nombre ?? null,
    subido_por_nombre: creador ? (nombres?.get(creador) ?? null) : null,
    responsable_nombre: responsable ? (nombres?.get(responsable) ?? null) : null,
  } as CoberturaFile;
}

/**
 * Nombres de los perfiles indicados. `cobertura_files` apunta a auth.users, no
 * a profiles, así que PostgREST no puede incrustarlos y hay que resolverlos.
 */
async function nombresDe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter(Boolean) as string[])];
  const mapa = new Map<string, string>();
  if (unicos.length === 0) return mapa;
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", unicos);
  for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
    const nombre = p.full_name?.trim();
    if (nombre) mapa.set(p.id, nombre);
  }
  return mapa;
}

/** Columnas del archivo más el nombre del equipo que lo produjo. */
const SELECT_FILE = "*, equipos_cobertura(nombre)";

export async function listCoberturas(): Promise<Cobertura[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coberturas")
    .select("*")
    .is("deleted_at", null)
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);
  return (data as Cobertura[]) ?? [];
}

export async function getCoberturaDetail(id: string): Promise<{
  cobertura: Cobertura | null;
  files: Record<Fase, CoberturaFile[]>;
  asistentes: Asistente[];
}> {
  const supabase = await createClient();
  const [{ data: cob }, { data: files }, { data: asistentes }] = await Promise.all([
    supabase.from("coberturas").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase
      .from("cobertura_files")
      .select(SELECT_FILE)
      .eq("cobertura_id", id)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("cobertura_asistentes")
      .select("id, cobertura_id, user_id, contacto_id, ciudadano_id, nombre, rol, organizacion, vinculo")
      .eq("cobertura_id", id)
      .order("created_at", { ascending: true }),
  ]);
  const filas = (files as Record<string, unknown>[]) ?? [];
  const nombres = await nombresDe(
    supabase,
    filas.flatMap((r) => [r.created_by as string | null, r.responsable_id as string | null]),
  );

  const grouped: Record<Fase, CoberturaFile[]> = { crudo: [], editado: [], aprobado: [] };
  for (const row of filas) {
    const f = aplanarFile(row, nombres);
    grouped[f.fase]?.push(f);
  }
  return {
    cobertura: (cob as Cobertura) ?? null,
    files: grouped,
    asistentes: (asistentes as Asistente[]) ?? [],
  };
}

export async function createCobertura(input: {
  nombre: string;
  descripcion?: string;
  fecha?: string;
  lugar?: string;
}): Promise<ActionResult<{ id: string }>> {
  if (!input.nombre?.trim()) return { ok: false, message: "El nombre es obligatorio." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("coberturas")
    .insert({
      nombre: input.nombre.trim(),
      descripcion: input.descripcion?.trim() || null,
      fecha: input.fecha || null,
      lugar: input.lugar?.trim() || null,
      responsable_id: user?.id ?? null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo crear la cobertura (¿permisos?)." };

  // Crea la carpeta en Drive con sus 3 subcarpetas (si Drive está conectado).
  try {
    const folders = await createCoberturaFolders(input.nombre.trim());
    if (folders) {
      const admin = createAdminClient();
      await admin
        .from("coberturas")
        .update({
          drive_folder_id: folders.root,
          drive_crudo_id: folders.crudo,
          drive_editado_id: folders.editado,
          drive_aprobado_id: folders.aprobado,
          drive_link: folders.link,
        })
        .eq("id", data.id);
    }
  } catch {
    /* si Drive falla, la cobertura igual queda creada (se puede reparar luego) */
  }

  revalidatePath("/dashboard/comunicaciones/coberturas");
  return { ok: true, message: "Cobertura creada.", data: { id: data.id } };
}

export async function updateCoberturaEstado(id: string, estado: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("coberturas").update({ estado }).eq("id", id);
  if (error) return { ok: false, message: "No se pudo actualizar." };
  revalidatePath(`/dashboard/comunicaciones/coberturas/${id}`);
  return { ok: true, message: "Estado actualizado." };
}

export async function softDeleteCobertura(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("coberturas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };
  revalidatePath("/dashboard/comunicaciones/coberturas");
  return { ok: true, message: "Cobertura eliminada." };
}

/* ────────────────────── Ficha: datos de la jornada ────────────────────── */

/** Limpia una lista de etiquetas escrita como texto separado por comas. */
function etiquetas(valor: string[] | undefined): string[] | undefined {
  if (valor === undefined) return undefined;
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const t of valor) {
    const limpia = t.trim();
    const clave = limpia.toLowerCase();
    if (limpia && !vistas.has(clave)) {
      vistas.add(clave);
      out.push(limpia);
    }
  }
  return out;
}

const texto = (v: string | null | undefined): string | null | undefined =>
  v === undefined ? undefined : v?.trim() || null;

export interface FichaCobertura {
  nombre?: string;
  descripcion?: string | null;
  fecha?: string | null;
  lugar?: string | null;
  objetivo?: string | null;
  resumen?: string | null;
  mensajes_clave?: string | null;
  temas?: string[];
  resultados?: string | null;
  compromisos?: string | null;
  aliados?: string | null;
  publico_estimado?: number | null;
  hashtags?: string[];
}

/** Guarda la ficha completa. Solo escribe los campos que llegan definidos. */
export async function updateCoberturaFicha(
  id: string,
  ficha: FichaCobertura,
): Promise<ActionResult<Cobertura>> {
  const supabase = await createClient();

  if (ficha.nombre !== undefined && !ficha.nombre.trim()) {
    return {
      ok: false,
      message: "Revisa los campos.",
      fieldErrors: { nombre: "El nombre no puede quedar vacío." },
    };
  }
  if (ficha.publico_estimado != null && (ficha.publico_estimado < 0 || !Number.isInteger(ficha.publico_estimado))) {
    return {
      ok: false,
      message: "Revisa los campos.",
      fieldErrors: { publico_estimado: "Escribe un número entero de personas." },
    };
  }

  const patch: Record<string, unknown> = {};
  if (ficha.nombre !== undefined) patch.nombre = ficha.nombre.trim();
  for (const campo of [
    "descripcion", "fecha", "lugar", "objetivo", "resumen",
    "mensajes_clave", "resultados", "compromisos", "aliados",
  ] as const) {
    const v = texto(ficha[campo]);
    if (v !== undefined) patch[campo] = v;
  }
  // La fecha vacía debe llegar como null, no como cadena: la columna es `date`.
  if (ficha.fecha !== undefined) patch.fecha = ficha.fecha?.trim() || null;
  if (ficha.publico_estimado !== undefined) patch.publico_estimado = ficha.publico_estimado;
  const temas = etiquetas(ficha.temas);
  if (temas !== undefined) patch.temas = temas;
  const hashtags = etiquetas(ficha.hashtags);
  if (hashtags !== undefined) patch.hashtags = hashtags;

  if (Object.keys(patch).length === 0) return { ok: false, message: "No hay cambios que guardar." };

  const { data, error } = await supabase
    .from("coberturas")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo guardar la ficha (¿permisos?)." };

  // Renombrar la cobertura no renombra su carpeta de Drive: la carpeta ya tiene
  // archivos y enlaces compartidos que no conviene mover por un cambio de título.
  revalidatePath(`/dashboard/comunicaciones/coberturas/${id}`);
  revalidatePath("/dashboard/comunicaciones/coberturas");
  return { ok: true, message: "Ficha guardada.", data: data as Cobertura };
}

/* ────────────────────────────── Asistentes ────────────────────────────── */

/** Contactos y ciudadanos que se pueden vincular como asistentes. */
export async function listPersonasVinculables(): Promise<PersonaVinculable[]> {
  const supabase = await createClient();
  const [{ data: usuarios }, { data: contactos }, { data: ciudadanos }] = await Promise.all([
    // Los usuarios de la plataforma van primero: son quienes identifican al
    // equipo que cubrió la jornada, que es lo que no se podía registrar antes.
    supabase
      .from("profiles")
      .select("id, full_name, cargo")
      .eq("is_active", true)
      .order("full_name", { ascending: true })
      .limit(500),
    supabase
      .from("contacts")
      .select("id, nombre, apellido, organizacion")
      .is("deleted_at", null)
      .order("nombre", { ascending: true })
      .limit(600),
    supabase
      .from("citizens")
      .select("id, nombre, apellido, documento")
      .is("deleted_at", null)
      .order("nombre", { ascending: true })
      .limit(600),
  ]);

  const personas: PersonaVinculable[] = [];
  for (const u of (usuarios ?? []) as { id: string; full_name: string | null; cargo: string | null }[]) {
    const nombre = u.full_name?.trim();
    if (nombre) personas.push({ id: u.id, tipo: "usuario", nombre, detalle: u.cargo ?? null });
  }
  for (const c of contactos ?? []) {
    personas.push({
      id: c.id,
      tipo: "contacto",
      nombre: [c.nombre, c.apellido].filter(Boolean).join(" ").trim(),
      detalle: c.organizacion ?? null,
    });
  }
  for (const c of ciudadanos ?? []) {
    personas.push({
      id: c.id,
      tipo: "ciudadano",
      nombre: [c.nombre, c.apellido].filter(Boolean).join(" ").trim(),
      detalle: c.documento ?? null,
    });
  }
  return personas.filter((p) => p.nombre.length > 0);
}

export async function addAsistente(input: {
  cobertura_id: string;
  nombre: string;
  rol?: string | null;
  user_id?: string | null;
  contacto_id?: string | null;
  ciudadano_id?: string | null;
  vinculo?: "equipo" | "aliado" | "otro";
  organizacion?: string | null;
}): Promise<ActionResult<Asistente>> {
  const nombre = input.nombre.trim();
  if (!nombre) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: { nombre: "Escribe un nombre." } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("cobertura_asistentes")
    .insert({
      cobertura_id: input.cobertura_id,
      nombre,
      rol: input.rol?.trim() || null,
      user_id: input.user_id ?? null,
      vinculo: input.vinculo ?? "otro",
      organizacion: input.organizacion?.trim() || null,
      contacto_id: input.contacto_id ?? null,
      ciudadano_id: input.ciudadano_id ?? null,
      created_by: user?.id ?? null,
    })
    .select("id, cobertura_id, user_id, contacto_id, ciudadano_id, nombre, rol, organizacion, vinculo")
    .single();

  if (error) {
    // 23505: los índices únicos parciales de la migración 0033.
    if (error.code === "23505") return { ok: false, message: "Esa persona ya está en la lista." };
    return { ok: false, message: "No se pudo agregar (¿permisos?)." };
  }

  revalidatePath(`/dashboard/comunicaciones/coberturas/${input.cobertura_id}`);
  return { ok: true, message: "Asistente agregado.", data: data as Asistente };
}

export async function removeAsistente(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("cobertura_asistentes").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo quitar." };
  return { ok: true, message: "Asistente quitado." };
}

/* ─────────────────────────────── Brief IA ─────────────────────────────── */

/**
 * Arma el texto que resume la cobertura para pegárselo a la IA. La consulta vive
 * aquí; el formato, en `lib/cobertura-brief.ts`, que es una función pura.
 */
export async function getBriefCobertura(id: string): Promise<ActionResult<{ texto: string }>> {
  const { cobertura, files, asistentes } = await getCoberturaDetail(id);
  if (!cobertura) return { ok: false, message: "Cobertura no encontrada." };

  // Se manda TODO lo que hay registrado de cada pieza. El análisis automático y
  // la atribución existían pero no llegaban al brief, así que la IA trabajaba a
  // ciegas sobre el material.
  const archivos = FASES.flatMap((fase) =>
    files[fase].map((f) => ({
      fase,
      nombre: f.nombre,
      mime: f.mime,
      descripcion: f.descripcion,
      analisis: (f as unknown as { analisis?: string | null }).analisis ?? null,
      analisis_etiquetas:
        (f as unknown as { analisis_etiquetas?: string[] | null }).analisis_etiquetas ?? null,
      equipo: f.equipo_nombre,
      dispositivo: f.dispositivo,
      responsable: f.responsable_nombre,
      tags: f.tags,
      destacado: f.destacado,
    })),
  );

  // La grabación con la que se contó la jornada: la fuente más rica que hay.
  const supabase = await createClient();
  const { data: dictado } = await supabase
    .from("cobertura_dictados")
    .select("transcripcion, created_at")
    .eq("cobertura_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const texto = construirBrief(
    cobertura,
    asistentes.map((a) => ({
      nombre: a.nombre,
      rol: a.rol,
      vinculo: a.vinculo,
      organizacion: a.organizacion,
      enlace: a.user_id ? "usuario" : a.contacto_id ? "contacto" : a.ciudadano_id ? "ciudadano" : null,
    })),
    archivos,
    (dictado as { transcripcion: string; created_at: string } | null) ?? null,
  );

  await logActivity("brief", "cobertura", id, cobertura.nombre);
  return { ok: true, message: "ok", data: { texto } };
}

/** Crea/repara la carpeta de Drive de una cobertura existente. */
export async function repairCoberturaDrive(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: cob } = await supabase.from("coberturas").select("nombre, drive_folder_id").eq("id", id).maybeSingle();
  if (!cob) return { ok: false, message: "Cobertura no encontrada." };
  const cfg = await getDriveConfig();
  if (!cfg.connected) return { ok: false, message: "Conecta Google Drive primero (Configuración → Integraciones)." };
  const folders = await createCoberturaFolders(cob.nombre);
  if (!folders) return { ok: false, message: "No se pudo crear la carpeta en Drive." };
  const admin = createAdminClient();
  await admin
    .from("coberturas")
    .update({
      drive_folder_id: folders.root,
      drive_crudo_id: folders.crudo,
      drive_editado_id: folders.editado,
      drive_aprobado_id: folders.aprobado,
      drive_link: folders.link,
    })
    .eq("id", id);
  revalidatePath(`/dashboard/comunicaciones/coberturas/${id}`);
  return { ok: true, message: "Carpeta de Drive creada/reparada." };
}

/**
 * Registra un archivo ya subido a Supabase (bucket 'coberturas'). Si Drive está
 * conectado, lo mueve a la subcarpeta de la fase y borra la copia temporal.
 */
export async function addCoberturaFile(input: {
  cobertura_id: string;
  fase: Fase;
  path: string;
  name: string;
  mime: string;
  size?: number;
  origen_file_id?: string | null;
  meta: MetadataArchivo;
}): Promise<ActionResult<CoberturaFile>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const invalida = await validarMetadata(supabase, input.meta);
  if (invalida) return { ok: false, message: invalida };

  const admin = createAdminClient();

  const publicUrl = admin.storage.from("coberturas").getPublicUrl(input.path).data.publicUrl;
  let url = publicUrl;
  let driveFileId: string | null = null;
  let storagePath: string | null = input.path;

  try {
    const { data: cob } = await admin
      .from("coberturas")
      .select("drive_crudo_id, drive_editado_id, drive_aprobado_id")
      .eq("id", input.cobertura_id)
      .maybeSingle();
    const folderId =
      input.fase === "crudo" ? cob?.drive_crudo_id
      : input.fase === "editado" ? cob?.drive_editado_id
      : cob?.drive_aprobado_id;

    if (folderId) {
      const { data: blob } = await admin.storage.from("coberturas").download(input.path);
      if (blob) {
        const buffer = Buffer.from(await blob.arrayBuffer());
        const res = await uploadBufferToFolder({ folderId, name: input.name, mime: input.mime, buffer });
        if (res) {
          url = res.link;
          driveFileId = res.id;
          await admin.storage.from("coberturas").remove([input.path]);
          storagePath = null;
        }
      }
    }
  } catch {
    /* deja la copia de Supabase si Drive falla */
  }

  const { data, error } = await supabase
    .from("cobertura_files")
    .insert({
      cobertura_id: input.cobertura_id,
      fase: input.fase,
      nombre: input.name,
      url,
      drive_file_id: driveFileId,
      storage_path: storagePath,
      mime: input.mime || null,
      size: input.size ?? null,
      orden: await nextOrden(input.cobertura_id, input.fase),
      origen_file_id: input.origen_file_id ?? null,
      equipo_id: input.meta.equipo_id,
      tipo_contenido: input.meta.tipo_contenido,
      dispositivo: input.meta.dispositivo ?? null,
      created_by: user?.id ?? null,
      // Arranca acreditado a quien sube; se puede cambiar desde la ficha.
      responsable_id: user?.id ?? null,
    })
    .select(SELECT_FILE)
    .single();
  if (error || !data) return { ok: false, message: "No se pudo registrar el archivo." };

  await logActivity("subida", "cobertura", input.cobertura_id, `${input.fase}: ${input.name}`);
  revalidatePath(`/dashboard/comunicaciones/coberturas/${input.cobertura_id}`);
  return { ok: true, message: "Archivo agregado.", data: aplanarFile(data) };
}

export async function removeCoberturaFile(id: string, storagePath?: string | null): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: file } = await supabase
    .from("cobertura_files")
    .select("drive_file_id, storage_path, nombre, cobertura_id")
    .eq("id", id)
    .maybeSingle();

  const path = storagePath ?? file?.storage_path ?? null;
  if (path) await supabase.storage.from("coberturas").remove([path]);

  const { error } = await supabase.from("cobertura_files").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar." };

  // Solo después de borrar la fila: si Drive falla, no dejamos una tarjeta
  // apuntando a un archivo que ya no existe.
  if (file?.drive_file_id) await deleteDriveFile(file.drive_file_id);
  if (file) await logActivity("eliminacion", "cobertura", file.cobertura_id, file.nombre);

  return { ok: true, message: "Archivo eliminado." };
}

/* ────────────────────── Galería: subida, orden y ficha ────────────────────── */

/** Id de la subcarpeta de Drive que corresponde a una fase. */
async function faseFolderId(coberturaId: string, fase: Fase): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("coberturas")
    .select("drive_crudo_id, drive_editado_id, drive_aprobado_id")
    .eq("id", coberturaId)
    .maybeSingle();
  if (!data) return null;
  if (fase === "crudo") return data.drive_crudo_id;
  if (fase === "editado") return data.drive_editado_id;
  return data.drive_aprobado_id;
}

export type UploadTicket =
  /** Drive conectado: el navegador sube los trozos directamente a Google. */
  | { mode: "drive"; uploadUrl: string }
  /** Sin Drive: se usa el bucket de Supabase, como antes. */
  | { mode: "storage" };

/**
 * Prepara la subida de un archivo. Con Drive conectado devuelve una sesión
 * reanudable para que los bytes vayan del navegador a Google sin pasar por
 * Vercel: así no hay límite de tamaño ni de duración de la función.
 */
export async function startCoberturaUpload(input: {
  cobertura_id: string;
  fase: Fase;
  name: string;
  mime: string;
  size: number;
  meta: MetadataArchivo;
}): Promise<ActionResult<UploadTicket>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };
  if (!FASES.includes(input.fase)) return { ok: false, message: "Fase no válida." };

  // Se valida ya, antes de abrir la sesión reanudable: si el equipo no sirve,
  // mejor enterarse antes de que el navegador empiece a mandar bytes a Drive.
  const invalida = await validarMetadata(supabase, input.meta);
  if (invalida) return { ok: false, message: invalida };

  const folderId = await faseFolderId(input.cobertura_id, input.fase);
  if (!folderId) return { ok: true, message: "ok", data: { mode: "storage" } };

  const uploadUrl = await createResumableUpload({
    folderId,
    name: input.name,
    mime: input.mime,
    size: input.size,
  });
  if (!uploadUrl) return { ok: true, message: "ok", data: { mode: "storage" } };

  return { ok: true, message: "ok", data: { mode: "drive", uploadUrl } };
}

/** Registra en la base de datos un archivo que el navegador ya subió a Drive. */
export async function finishCoberturaUpload(input: {
  cobertura_id: string;
  fase: Fase;
  drive_file_id: string;
  name: string;
  mime: string;
  size: number;
  origen_file_id?: string | null;
  meta: MetadataArchivo;
}): Promise<ActionResult<CoberturaFile>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const invalida = await validarMetadata(supabase, input.meta);
  if (invalida) return { ok: false, message: invalida };

  await makeDriveFilePublic(input.drive_file_id);

  const { data, error } = await supabase
    .from("cobertura_files")
    .insert({
      cobertura_id: input.cobertura_id,
      fase: input.fase,
      nombre: input.name,
      url: driveViewLink(input.drive_file_id),
      drive_file_id: input.drive_file_id,
      storage_path: null,
      mime: input.mime || null,
      size: input.size ?? null,
      orden: await nextOrden(input.cobertura_id, input.fase),
      origen_file_id: input.origen_file_id ?? null,
      equipo_id: input.meta.equipo_id,
      tipo_contenido: input.meta.tipo_contenido,
      dispositivo: input.meta.dispositivo ?? null,
      created_by: user?.id ?? null,
      // Arranca acreditado a quien sube; se puede cambiar desde la ficha.
      responsable_id: user?.id ?? null,
    })
    .select(SELECT_FILE)
    .single();
  if (error || !data) return { ok: false, message: "No se pudo registrar el archivo." };

  await logActivity("subida", "cobertura", input.cobertura_id, `${input.fase}: ${input.name}`);
  revalidatePath(`/dashboard/comunicaciones/coberturas/${input.cobertura_id}`);
  return { ok: true, message: "Archivo agregado.", data: aplanarFile(data) };
}

async function nextOrden(coberturaId: string, fase: Fase): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cobertura_files")
    .select("orden")
    .eq("cobertura_id", coberturaId)
    .eq("fase", fase)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.orden ?? 0) + 1;
}

/**
 * Cambia un archivo de fase y fija el orden de la columna destino.
 * Mueve también el archivo en Drive, para que la carpeta refleje lo que se ve.
 */
export async function moveCoberturaFile(input: {
  file_id: string;
  fase: Fase;
  /** Ids de la columna destino en su orden final, incluido el que se mueve. */
  orden_destino: string[];
}): Promise<ActionResult> {
  if (!FASES.includes(input.fase)) return { ok: false, message: "Fase no válida." };
  const supabase = await createClient();

  const { data: file } = await supabase
    .from("cobertura_files")
    .select("cobertura_id, fase, nombre, drive_file_id")
    .eq("id", input.file_id)
    .maybeSingle();
  if (!file) return { ok: false, message: "Archivo no encontrado." };

  const { error } = await supabase
    .from("cobertura_files")
    .update({ fase: input.fase })
    .eq("id", input.file_id);
  if (error) return { ok: false, message: "No se pudo mover el archivo." };

  await applyOrden(input.orden_destino);

  if (file.fase !== input.fase && file.drive_file_id) {
    const folderId = await faseFolderId(file.cobertura_id, input.fase);
    // Si Drive falla, la tarjeta ya está en su nueva columna; la carpeta se
    // corrige al volver a moverla o desde "Crear carpeta en Drive".
    if (folderId) await moveDriveFile(file.drive_file_id, folderId);
    await logActivity(
      "movimiento",
      "cobertura",
      file.cobertura_id,
      `${file.nombre}: ${FASE_LABEL[file.fase as Fase]} → ${FASE_LABEL[input.fase]}`,
    );
  }

  revalidatePath(`/dashboard/comunicaciones/coberturas/${file.cobertura_id}`);
  return { ok: true, message: `Movido a ${FASE_LABEL[input.fase]}.` };
}

/** Reordena una columna sin cambiar de fase. */
export async function reorderCoberturaFiles(ids: string[]): Promise<ActionResult> {
  await applyOrden(ids);
  return { ok: true, message: "Orden actualizado." };
}

/** Una sola sentencia para toda la columna: arrastrar no debe costar N viajes. */
async function applyOrden(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await createClient();
  await supabase.rpc("reordenar_cobertura_files", { p_ids: ids });
}

/**
 * Cambia a quién se le acredita una pieza. No toca `created_by`: quién la subió
 * es un hecho de auditoría y no se reescribe.
 */
export async function setResponsableArchivo(
  fileId: string,
  responsableId: string | null,
): Promise<ActionResult<CoberturaFile>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cobertura_files")
    .update({ responsable_id: responsableId })
    .eq("id", fileId)
    .select(SELECT_FILE)
    .single();
  if (error || !data) return { ok: false, message: "No se pudo cambiar el responsable." };

  const fila = data as Record<string, unknown>;
  const nombres = await nombresDe(supabase, [
    fila.created_by as string | null,
    fila.responsable_id as string | null,
  ]);
  const file = aplanarFile(fila, nombres);
  revalidatePath(`/dashboard/comunicaciones/coberturas/${file.cobertura_id}`);
  return { ok: true, message: "Responsable actualizado.", data: file };
}

/** Edita la ficha de un archivo. El renombrado se refleja también en Drive. */
export async function updateCoberturaFileMeta(input: {
  file_id: string;
  nombre?: string;
  descripcion?: string | null;
  tags?: string[];
  destacado?: boolean;
}): Promise<ActionResult<CoberturaFile>> {
  const supabase = await createClient();

  const nombre = input.nombre?.trim();
  if (input.nombre !== undefined && !nombre) {
    return { ok: false, message: "Revisa los campos.", fieldErrors: { nombre: "El nombre no puede quedar vacío." } };
  }

  const patch: Record<string, unknown> = {};
  if (nombre) patch.nombre = nombre;
  if (input.descripcion !== undefined) patch.descripcion = input.descripcion?.trim() || null;
  if (input.tags !== undefined) patch.tags = input.tags.map((t) => t.trim()).filter(Boolean);
  if (input.destacado !== undefined) patch.destacado = input.destacado;
  if (Object.keys(patch).length === 0) return { ok: false, message: "No hay cambios que guardar." };

  const { data, error } = await supabase
    .from("cobertura_files")
    .update(patch)
    .eq("id", input.file_id)
    .select("*")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo guardar la ficha." };

  if (nombre && data.drive_file_id) await renameDriveFile(data.drive_file_id, nombre);

  revalidatePath(`/dashboard/comunicaciones/coberturas/${data.cobertura_id}`);
  return { ok: true, message: "Ficha guardada.", data: data as CoberturaFile };
}

/**
 * Prepara el reemplazo del contenido de un archivo conservando su id, su enlace
 * y su posición. Drive guarda la versión anterior en su historial de revisiones.
 */
export async function startCoberturaReplace(input: {
  file_id: string;
  mime: string;
  size: number;
}): Promise<ActionResult<UploadTicket>> {
  const supabase = await createClient();
  const { data: file } = await supabase
    .from("cobertura_files")
    .select("drive_file_id")
    .eq("id", input.file_id)
    .maybeSingle();
  if (!file) return { ok: false, message: "Archivo no encontrado." };
  if (!file.drive_file_id) {
    return { ok: false, message: "Solo se pueden reemplazar archivos alojados en Drive." };
  }

  const uploadUrl = await createResumableUpdate({
    fileId: file.drive_file_id,
    mime: input.mime,
    size: input.size,
  });
  if (!uploadUrl) return { ok: false, message: "No se pudo preparar el reemplazo en Drive." };

  return { ok: true, message: "ok", data: { mode: "drive", uploadUrl } };
}

/** Cierra el reemplazo: actualiza nombre, tipo, tamaño y sube el número de versión. */
export async function finishCoberturaReplace(input: {
  file_id: string;
  name: string;
  mime: string;
  size: number;
}): Promise<ActionResult<CoberturaFile>> {
  const supabase = await createClient();
  const { data: prev } = await supabase
    .from("cobertura_files")
    .select("version, drive_file_id, cobertura_id")
    .eq("id", input.file_id)
    .maybeSingle();
  if (!prev) return { ok: false, message: "Archivo no encontrado." };

  const { data, error } = await supabase
    .from("cobertura_files")
    .update({
      nombre: input.name,
      mime: input.mime || null,
      size: input.size ?? null,
      version: (prev.version ?? 1) + 1,
    })
    .eq("id", input.file_id)
    .select("*")
    .single();
  if (error || !data) return { ok: false, message: "No se pudo registrar la nueva versión." };

  if (prev.drive_file_id) await renameDriveFile(prev.drive_file_id, input.name);
  await logActivity(
    "version",
    "cobertura",
    prev.cobertura_id,
    `${input.name} → v${(prev.version ?? 1) + 1}`,
  );

  revalidatePath(`/dashboard/comunicaciones/coberturas/${prev.cobertura_id}`);
  return { ok: true, message: `Versión ${(prev.version ?? 1) + 1} guardada.`, data: data as CoberturaFile };
}

/* ────────────────────────── Portadas del listado ────────────────────────── */

/** Cuántas piezas rotan en la portada de cada cobertura. */
const PIEZAS_PORTADA = 6;

/**
 * Prioridad de una pieza para la portada: primero lo que alguien marcó como
 * destacado, después lo aprobado, y el crudo de último. Dentro de cada grupo el
 * orden es aleatorio, así el listado no se ve igual en cada visita.
 */
function pesoPortada(f: { destacado: boolean | null; fase: Fase }): number {
  if (f.destacado) return 0;
  if (f.fase === "aprobado") return 1;
  if (f.fase === "editado") return 2;
  return 3;
}

/**
 * Miniaturas para la portada de cada cobertura del listado.
 *
 * Se resuelve en una sola consulta para todas: una por cobertura convertiría el
 * listado en N+1 peticiones. El barajado va aquí, en el servidor, para que el
 * cliente reciba el orden ya hecho y no haya desajuste de hidratación.
 */
export async function listPortadas(
  coberturaIds: string[],
): Promise<Record<string, string[]>> {
  if (coberturaIds.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase
    .from("cobertura_files")
    .select("cobertura_id, fase, nombre, url, drive_file_id, storage_path, mime, destacado")
    .in("cobertura_id", coberturaIds)
    .in("tipo_contenido", ["foto", "video"]);

  type Fila = PiezaConMiniatura & {
    cobertura_id: string;
    fase: Fase;
    destacado: boolean | null;
  };

  const porCobertura = new Map<string, Fila[]>();
  for (const fila of (data ?? []) as Fila[]) {
    const lista = porCobertura.get(fila.cobertura_id) ?? [];
    lista.push(fila);
    porCobertura.set(fila.cobertura_id, lista);
  }

  const out: Record<string, string[]> = {};
  for (const [id, filas] of porCobertura) {
    const srcs = filas
      .map((f) => ({ f, r: Math.random() }))
      .sort((a, b) => pesoPortada(a.f) - pesoPortada(b.f) || a.r - b.r)
      .map(({ f }) => miniaturaSrc(f, 600))
      .filter((s): s is string => s !== null)
      .slice(0, PIEZAS_PORTADA);
    if (srcs.length > 0) out[id] = srcs;
  }
  return out;
}
