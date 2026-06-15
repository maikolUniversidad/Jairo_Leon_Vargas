"use client";

import { useState, useTransition } from "react";
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
import { initials } from "@/lib/utils";
import { CONTACT_TIPOS, CONTACT_TIPO_LABELS } from "@/types/database";
import { uploadToBucket } from "@/actions/storage";
import { createContact } from "@/actions/contactos";

interface ZoneOpt { id: string; nombre_zona: string }

export function ContactCreateDialog({ zones }: { zones: ZoneOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [foto, setFoto] = useState("");
  const [f, setF] = useState({
    nombre: "", apellido: "", puesto: "", organizacion: "", tipo: "aliado",
    influencia: "", telefono: "", whatsapp: "", email: "", localidad: "",
    barrio: "", direccion: "", zona_id: "", notas: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function uploadFoto(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("prefix", "fotos");
      const up = await uploadToBucket("contact-files", fd);
      if (up.ok && up.data) setFoto(up.data.url);
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
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
              <ImageUp className="size-4" /> {uploading ? "Subiendo…" : "Subir foto"}
              <input type="file" accept="image/*" className="hidden" disabled={uploading}
                onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFoto(file); e.target.value = ""; }} />
            </label>
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
              <Select value={f.zona_id} onValueChange={(v) => set("zona_id", v)}>
                <SelectTrigger><SelectValue placeholder="Sin zona" /></SelectTrigger>
                <SelectContent>
                  {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.nombre_zona}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Localidad</Label><Input value={f.localidad} onChange={(e) => set("localidad", e.target.value)} /></div>
            <div><Label>Barrio</Label><Input value={f.barrio} onChange={(e) => set("barrio", e.target.value)} /></div>
          </div>
          <div><Label>Notas</Label><Textarea rows={2} value={f.notas} onChange={(e) => set("notas", e.target.value)} /></div>

          <Button className="w-full" disabled={pending || uploading} onClick={submit}>
            {pending ? "Creando…" : "Crear contacto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
