"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, ImageUp, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldErrorSummary, useFieldErrors } from "@/components/ui/field";
import { initials } from "@/lib/utils";
import { contactSchema } from "@/lib/validations";
import { uploadFileViaSignedUrl } from "@/lib/upload";
import { ImageCropper, CROP_PRESETS } from "@/components/dashboard/image-cropper";
import {
  ContactFormFields,
  type ContactFormState,
  type ZoneOpt,
} from "@/components/dashboard/contact-form-fields";
import type { Contact } from "@/types/database";
import { updateContact, softDeleteContact } from "@/actions/contactos";

/** Vuelca un contacto de la base al estado del formulario (todo string). */
function aFormulario(c: Contact): ContactFormState {
  const s = (v: string | null) => v ?? "";
  return {
    nombre: s(c.nombre), apellido: s(c.apellido), puesto: s(c.puesto),
    organizacion: s(c.organizacion), tipo: c.tipo || "aliado",
    influencia: s(c.influencia), telefono: s(c.telefono), whatsapp: s(c.whatsapp),
    email: s(c.email), localidad: s(c.localidad), barrio: s(c.barrio),
    direccion: s(c.direccion), zona_id: s(c.zona_id), notas: s(c.notas),
    telefono_2: s(c.telefono_2), email_2: s(c.email_2),
    facebook: s(c.facebook), instagram: s(c.instagram), x_twitter: s(c.x_twitter),
    tiktok: s(c.tiktok), sitio_web: s(c.sitio_web),
    documento: s(c.documento),
    // El input date necesita YYYY-MM-DD.
    fecha_nacimiento: c.fecha_nacimiento ? c.fecha_nacimiento.slice(0, 10) : "",
    genero: s(c.genero),
    otros_datos: s(c.otros_datos),
  };
}

export function ContactEditDialog({
  contact,
  zones,
  open,
  onOpenChange,
}: {
  contact: Contact;
  zones: ZoneOpt[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [foto, setFoto] = useState(contact.foto_url ?? "");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [f, setF] = useState<ContactFormState>(() => aFormulario(contact));

  const fe = useFieldErrors();
  const set = (k: keyof ContactFormState, v: string) => {
    fe.clear(k);
    setF((p) => ({ ...p, [k]: v }));
  };

  async function uploadFoto(file: File) {
    setUploading(true);
    try {
      const up = await uploadFileViaSignedUrl("contact-files", "fotos", file);
      if (up.ok && up.url) { setFoto(up.url); setCropFile(null); }
      else toast.error(up.message);
    } finally { setUploading(false); }
  }

  function submit() {
    const payload = { ...f, foto_url: foto };
    if (!fe.validate(contactSchema, payload)) return;

    start(async () => {
      const res = await updateContact(contact.id, payload);
      if (res.ok) {
        toast.success(res.message);
        onOpenChange(false);
        fe.clear();
        router.refresh();
      } else if (!fe.fromResult(res)) toast.error(res.message);
    });
  }

  function eliminar() {
    if (!confirm(`¿Eliminar a ${contact.nombre}? Se puede recuperar desde la base de datos.`)) return;
    start(async () => {
      const res = await softDeleteContact(contact.id);
      if (res.ok) {
        toast.success(res.message);
        router.push("/dashboard/contactos");
      } else toast.error(res.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4" /> Editar contacto
          </DialogTitle>
        </DialogHeader>
        <div ref={fe.containerRef} className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-bold text-white">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" className="size-full object-cover" />
              ) : initials(f.nombre || "Contacto")}
            </span>
            <div>
              <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                <ImageUp className="size-4" /> Cambiar foto
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) setCropFile(file); e.target.value = ""; }} />
              </label>
              <p className="mt-1 text-xs text-muted-foreground">{CROP_PRESETS.avatar.label}</p>
            </div>
          </div>

          {/* Al editar se abre ya desplegado: si hay datos extra, que se vean. */}
          <ContactFormFields f={f} set={set} fe={fe} zones={zones} defaultExpanded />

          <FieldErrorSummary errors={fe.errors} onFocus={fe.focusFirstInvalid} />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={pending}
              onClick={eliminar}
            >
              <Trash2 className="size-4" /> Eliminar
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button disabled={pending || uploading} onClick={submit}>
                {pending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </div>
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
