"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ImageUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { initials } from "@/lib/utils";
import { normalizeName } from "@/lib/geo-sources";
import { LOCALIDADES } from "@/lib/validations";
import {
  CONTACT_TIPOS,
  CONTACT_TIPO_LABELS,
  ZONE_TYPES,
  ZONE_TYPE_LABELS,
  type ZoneType,
} from "@/types/database";
import { uploadFileViaSignedUrl } from "@/lib/upload";
import { ImageCropper, CROP_PRESETS } from "@/components/dashboard/image-cropper";
import { createContact } from "@/actions/contactos";
import { ensureZone } from "@/actions/territorio";

interface ZoneOpt { id: string; nombre_zona: string; tipo_zona?: ZoneType | null }

/** Marca las opciones que aún no existen en `zones` y hay que registrar al elegirlas. */
const SUGERIDA = "sugerida:";

export function ContactCreateDialog({ zones }: { zones: ZoneOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [foto, setFoto] = useState("");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [zoneOpts, setZoneOpts] = useState<ZoneOpt[]>(zones);
  const [zoneBusy, setZoneBusy] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState<ZoneType>("localidad");
  const [f, setF] = useState({
    nombre: "", apellido: "", puesto: "", organizacion: "", tipo: "aliado",
    influencia: "", telefono: "", whatsapp: "", email: "", localidad: "",
    barrio: "", direccion: "", zona_id: "", notas: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Mantiene las zonas del servidor sin perder las que se acaban de registrar aquí.
  useEffect(() => {
    setZoneOpts((prev) => {
      const merged = new Map(prev.map((z) => [z.id, z]));
      for (const z of zones) merged.set(z.id, z);
      return [...merged.values()];
    });
  }, [zones]);

  /** Zonas registradas + localidades de Bogotá que todavía no existen como zona. */
  const zonaOptions = useMemo<ComboboxOption[]>(() => {
    const registradas = [...zoneOpts]
      .sort((a, b) => a.nombre_zona.localeCompare(b.nombre_zona, "es"))
      .map((z) => ({
        value: z.id,
        label: z.nombre_zona,
        hint: z.tipo_zona ? ZONE_TYPE_LABELS[z.tipo_zona] : undefined,
      }));
    const existentes = new Set(zoneOpts.map((z) => normalizeName(z.nombre_zona)));
    const sugeridas = LOCALIDADES.filter(
      (l) => l !== "Otra" && !existentes.has(normalizeName(l)),
    ).map((l) => ({
      value: `${SUGERIDA}localidad:${l}`,
      label: l,
      hint: "Localidad",
      keywords: ["bogota"],
      suggested: true,
    }));
    return [...registradas, ...sugeridas];
  }, [zoneOpts]);

  /** Busca o crea la zona en la base y la deja seleccionada. */
  async function registrarZona(nombre: string, tipo: ZoneType) {
    setZoneBusy(true);
    try {
      const res = await ensureZone(nombre.trim(), tipo);
      const z = res.ok ? res.data?.zone : null;
      if (!z) {
        toast.error(res.ok ? "No se pudo registrar la zona." : res.message);
        return;
      }
      setZoneOpts((prev) =>
        prev.some((o) => o.id === z.id)
          ? prev
          : [...prev, { id: z.id, nombre_zona: z.nombre_zona, tipo_zona: z.tipo_zona }],
      );
      set("zona_id", z.id);
      toast.success(`Zona «${z.nombre_zona}» registrada.`);
    } finally {
      setZoneBusy(false);
    }
  }

  function elegirZona(v: string) {
    if (!v.startsWith(SUGERIDA)) return set("zona_id", v);
    const raw = v.slice(SUGERIDA.length);
    const i = raw.indexOf(":");
    void registrarZona(raw.slice(i + 1), raw.slice(0, i) as ZoneType);
  }

  async function uploadFoto(file: File) {
    setUploading(true);
    try {
      const up = await uploadFileViaSignedUrl("contact-files", "fotos", file);
      if (up.ok && up.url) { setFoto(up.url); setCropFile(null); }
      else toast.error(up.message);
    } finally { setUploading(false); }
  }

  function submit() {
    if (!f.nombre.trim()) return toast.error("Escribe el nombre.");
    start(async () => {
      const res = await createContact({ ...f, foto_url: foto });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        setF({ nombre: "", apellido: "", puesto: "", organizacion: "", tipo: "aliado", influencia: "", telefono: "", whatsapp: "", email: "", localidad: "", barrio: "", direccion: "", zona_id: "", notas: "" });
        setFoto("");
        router.refresh();
      } else toast.error(res.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> Nuevo contacto</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Nuevo contacto</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-bold text-white">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" className="size-full object-cover" />
              ) : initials(f.nombre || "Contacto")}
            </span>
            <div>
              <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                <ImageUp className="size-4" /> Subir y recortar
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) setCropFile(file); e.target.value = ""; }} />
              </label>
              <p className="mt-1 text-xs text-muted-foreground">{CROP_PRESETS.avatar.label}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Nombre *</Label><Input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
            <div><Label>Apellido</Label><Input value={f.apellido} onChange={(e) => set("apellido", e.target.value)} /></div>
            <div><Label>Puesto / cargo</Label><Input value={f.puesto} onChange={(e) => set("puesto", e.target.value)} placeholder="Presidente JAC, Edil…" /></div>
            <div><Label>Organización</Label><Input value={f.organizacion} onChange={(e) => set("organizacion", e.target.value)} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={f.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTACT_TIPOS.map((t) => <SelectItem key={t} value={t}>{CONTACT_TIPO_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Influencia</Label>
              <Select value={f.influencia} onValueChange={(v) => set("influencia", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Teléfono</Label><Input value={f.telefono} onChange={(e) => set("telefono", e.target.value)} /></div>
            <div><Label>WhatsApp</Label><Input value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></div>
            <div><Label>Correo</Label><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div>
              <Label>Zona / territorio</Label>
              <Combobox
                value={f.zona_id}
                onChange={elegirZona}
                options={zonaOptions}
                busy={zoneBusy}
                placeholder="Sin zona"
                searchPlaceholder="Buscar zona o territorio…"
                emptyText="No está registrada. Escríbela para crearla."
                onCreate={(nombre) => registrarZona(nombre, nuevoTipo)}
                createLabel="Crear zona"
                createSlot={
                  <select
                    value={nuevoTipo}
                    onChange={(e) => setNuevoTipo(e.target.value as ZoneType)}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-muted-foreground"
                  >
                    {ZONE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        Como {ZONE_TYPE_LABELS[t].toLowerCase()}
                      </option>
                    ))}
                  </select>
                }
              />
            </div>
            <div><Label>Localidad</Label><Input value={f.localidad} onChange={(e) => set("localidad", e.target.value)} /></div>
            <div><Label>Barrio</Label><Input value={f.barrio} onChange={(e) => set("barrio", e.target.value)} /></div>
          </div>
          <div><Label>Notas</Label><Textarea rows={2} value={f.notas} onChange={(e) => set("notas", e.target.value)} /></div>

          <Button className="w-full" disabled={pending || uploading} onClick={submit}>
            {pending ? "Creando…" : "Crear contacto"}
          </Button>
        </div>

        <ImageCropper
          open={!!cropFile}
          file={cropFile}
          target={CROP_PRESETS.avatar}
          busy={uploading}
          onCancel={() => setCropFile(null)}
          onConfirm={uploadFoto}
        />
      </DialogContent>
    </Dialog>
  );
}
