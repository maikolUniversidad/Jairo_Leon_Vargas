"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDrive, getDriveThumbnail } from "@/lib/google-drive";
import { extractDocumentText } from "@/lib/kb/extract";
import { resolveProvider } from "@/lib/ia/provider";
import { logActivity } from "@/lib/activity";
import {
  AnalisisInvalido,
  AnalisisNoAplicable,
  construirMensajes,
  modeloPara,
  parsearResultado,
  redactarAnalisis,
  type MensajeAnalisis,
} from "@/lib/ia/analisis-material";
import { type TipoContenido } from "@/lib/media-kind";

/** Ancho de la miniatura que se le manda al modelo de visión. */
const ANCHO_ANALISIS = 1024;

export interface ResultadoArchivo {
  file_id: string;
  analisis: string;
  etiquetas: string[];
  /** Descripción y etiquetas que el análisis rellenó por estar vacías. */
  descripcion?: string;
  tags?: string[];
}

/**
 * `ActionResult` no lleva datos en su rama de fallo, y aquí la cola necesita
 * distinguir tres desenlaces distintos para decidir si reintenta:
 * `pendiente` (la miniatura aún no existe), `omitido` (no hay nada que
 * reintentar) y `error` (falló, se puede volver a intentar).
 */
export type RespuestaAnalisis =
  | { ok: true; message: string; data: ResultadoArchivo }
  | { ok: false; message: string; estado: "pendiente" | "omitido" | "error" };

interface FilaArchivo {
  id: string;
  cobertura_id: string;
  nombre: string;
  mime: string | null;
  tipo_contenido: TipoContenido;
  drive_file_id: string | null;
  storage_path: string | null;
  url: string;
  descripcion: string | null;
  tags: string[];
}

/* ─────────────────────────── Llamada al proveedor ─────────────────────────── */

/**
 * Completación sin streaming. `completeWithTools` del proveedor obliga a pasar
 * herramientas, que aquí no hacen falta, así que se llama directo al endpoint.
 */
async function completar(modelo: string, messages: MensajeAnalisis[]): Promise<string> {
  const cfg = resolveProvider(modelo);
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: 0.2,
      max_tokens: 600,
      stream: false,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    throw new Error(`El proveedor respondió ${res.status}: ${detalle.slice(0, 160)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

/* ──────────────────────────── Obtención de la entrada ──────────────────────────── */

/** Miniatura de la pieza como data URL, o null si Drive aún no la generó. */
async function miniaturaDataUrl(fila: FilaArchivo): Promise<string | null> {
  if (fila.drive_file_id) {
    const thumb = await getDriveThumbnail(fila.drive_file_id, ANCHO_ANALISIS);
    if (!thumb) return null;
    const base64 = Buffer.from(thumb.body).toString("base64");
    return `data:${thumb.contentType};base64,${base64}`;
  }
  // Sin Drive el archivo sigue en el bucket público: se descarga tal cual.
  if (fila.storage_path) {
    const admin = createAdminClient();
    const { data } = await admin.storage.from("coberturas").download(fila.storage_path);
    if (!data) return null;
    const buffer = Buffer.from(await data.arrayBuffer());
    return `data:${fila.mime || "image/jpeg"};base64,${buffer.toString("base64")}`;
  }
  return null;
}

/** Bytes del documento, de donde esté alojado. */
async function bytesDocumento(fila: FilaArchivo): Promise<Buffer | null> {
  if (fila.drive_file_id) {
    const drive = await getDrive();
    if (!drive) return null;
    const res = await drive.files.get(
      { fileId: fila.drive_file_id, alt: "media" },
      { responseType: "arraybuffer" },
    );
    return Buffer.from(res.data as ArrayBuffer);
  }
  if (fila.storage_path) {
    const admin = createAdminClient();
    const { data } = await admin.storage.from("coberturas").download(fila.storage_path);
    if (!data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  return null;
}

/* ─────────────────────────────── Acción principal ─────────────────────────────── */

/**
 * Analiza una pieza y guarda el resultado.
 *
 * Además rellena la descripción y las etiquetas del archivo **solo si están
 * vacías**: lo que alguien escribió a mano nunca se pisa.
 */
export async function analizarArchivo(fileId: string): Promise<RespuestaAnalisis> {
  const supabase = await createClient();

  const { data: fila } = await supabase
    .from("cobertura_files")
    .select("id, cobertura_id, nombre, mime, tipo_contenido, drive_file_id, storage_path, url, descripcion, tags")
    .eq("id", fileId)
    .maybeSingle();
  if (!fila) return { ok: false, message: "Archivo no encontrado.", estado: "omitido" };

  const archivo = fila as FilaArchivo;

  const guardar = async (patch: Record<string, unknown>) => {
    await supabase.from("cobertura_files").update(patch).eq("id", fileId);
  };

  try {
    const modelo = modeloPara(archivo.tipo_contenido);

    let mensajes: MensajeAnalisis[];
    if (archivo.tipo_contenido === "documento") {
      const buffer = await bytesDocumento(archivo);
      if (!buffer) throw new AnalisisNoAplicable("No se pudo descargar el documento.");
      const { text } = await extractDocumentText(buffer, archivo.nombre, archivo.mime ?? "");
      mensajes = construirMensajes({ tipo: "documento", nombre: archivo.nombre, texto: text });
    } else {
      const imagenDataUrl = await miniaturaDataUrl(archivo);
      // Sin miniatura todavía: se deja pendiente y la cola reintenta. No es un
      // error del análisis, es que Drive aún no la generó.
      if (!imagenDataUrl) {
        await guardar({ analisis_estado: "pendiente", analisis_error: "La miniatura todavía no está lista." });
        return { ok: false, message: "La miniatura todavía no está lista.", estado: "pendiente" };
      }
      mensajes = construirMensajes({
        tipo: archivo.tipo_contenido,
        nombre: archivo.nombre,
        imagenDataUrl,
      });
    }

    const bruto = await completar(modelo, mensajes);
    const resultado = parsearResultado(bruto);
    const texto = redactarAnalisis(archivo.tipo_contenido, resultado);

    // Rellena lo que esté vacío; nunca pisa lo escrito a mano.
    const patch: Record<string, unknown> = {
      analisis: texto,
      analisis_etiquetas: resultado.etiquetas,
      analisis_estado: "listo",
      analisis_error: null,
      analisis_modelo: modelo,
      analisis_at: new Date().toISOString(),
    };
    const rellenaDescripcion = !archivo.descripcion?.trim();
    const rellenaTags = (archivo.tags ?? []).length === 0 && resultado.etiquetas.length > 0;
    if (rellenaDescripcion) patch.descripcion = resultado.resumen;
    if (rellenaTags) patch.tags = resultado.etiquetas;

    await guardar(patch);
    revalidatePath(`/dashboard/comunicaciones/coberturas/${archivo.cobertura_id}`);

    return {
      ok: true,
      message: "Análisis listo.",
      data: {
        file_id: fileId,
        analisis: texto,
        etiquetas: resultado.etiquetas,
        ...(rellenaDescripcion ? { descripcion: resultado.resumen } : {}),
        ...(rellenaTags ? { tags: resultado.etiquetas } : {}),
      },
    };
  } catch (e) {
    // `AnalisisNoAplicable` no es un fallo que se arregle reintentando (un audio,
    // un PDF escaneado): se marca omitido para que no vuelva a la cola.
    const omitido = e instanceof AnalisisNoAplicable;
    const message =
      e instanceof AnalisisInvalido
        ? "El modelo devolvió una respuesta que no se pudo leer."
        : e instanceof Error
          ? e.message
          : "No se pudo analizar.";

    await guardar({
      analisis_estado: omitido ? "omitido" : "error",
      analisis_error: message,
      analisis_at: new Date().toISOString(),
    });

    return { ok: false, message, estado: omitido ? "omitido" : "error" };
  }
}

/** Ids de las piezas de una cobertura que todavía no tienen análisis. */
export async function listarPendientesAnalisis(coberturaId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cobertura_files")
    .select("id")
    .eq("cobertura_id", coberturaId)
    .in("analisis_estado", ["pendiente", "error"])
    .in("tipo_contenido", ["foto", "video", "documento"])
    .order("created_at", { ascending: true });
  return ((data as { id: string }[]) ?? []).map((f) => f.id);
}

/** Deja constancia de una tanda de análisis en el registro de actividad. */
export async function registrarTandaAnalisis(
  coberturaId: string,
  listos: number,
  fallidos: number,
): Promise<void> {
  await logActivity(
    "analisis",
    "cobertura",
    coberturaId,
    `${listos} analizados, ${fallidos} sin analizar`,
  );
}
