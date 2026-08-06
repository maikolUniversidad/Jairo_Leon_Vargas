"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ImageUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldErrorSummary, useFieldErrors } from "@/components/ui/field";
import { initials } from "@/lib/utils";
import { contactSchema } from "@/lib/validations";
import { uploadFileViaSignedUrl } from "@/lib/upload";
import { ImageCropper, CROP_PRESETS } from "@/components/dashboard/image-cropper";
import {
  ContactFormFields,
  CONTACT_FORM_VACIO,
  type ContactFormState,
  type ZoneOpt,
} from "@/components/dashboard/contact-form-fields";
import { createContact } from "@/actions/contactos";

export function ContactCreateDialog({ zones }: { zones: ZoneOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [foto, setFoto] = useState("");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [f, setF] = useState<ContactFormState>(CONTACT_FORM_VACIO);

  const fe = useFieldErrors();
  // Al escribir se borra el error de ese campo: el rojo desaparece al corregir.
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
    // Valida con el MISMO esquema del server action, para señalar el campo
    // exacto sin esperar el viaje al servidor.
    const payload = { ...f, foto_url: foto };
    if (!fe.validate(contactSchema, payload)) return;

    start(async () => {
      const res = await createContact(payload);
      if (res.ok) {
        setOpen(false);
        setF(CONTACT_FORM_VACIO);
        setFoto("");
        fe.clear();
        // Lleva directo a la ficha para poder gestionarlo (WhatsApp, correo,
        // editar) sin tener que buscarlo de nuevo en la lista.
        if (res.data?.id) {
          toast.success(`${payload.nombre} creado. Abriendo su ficha…`);
          router.push(`/dashboard/contactos/${res.data.id}`);
        } else {
          toast.success(res.message);
          router.refresh();
        }
      } else if (!fe.fromResult(res)) toast.error(res.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> Nuevo contacto</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Nuevo contacto</DialogTitle></DialogHeader>
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
                <ImageUp className="size-4" /> Subir y recortar
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) setCropFile(file); e.target.value = ""; }} />
              </label>
              <p className="mt-1 text-xs text-muted-foreground">{CROP_PRESETS.avatar.label}</p>
            </div>
          </div>

          <ContactFormFields f={f} set={set} fe={fe} zones={zones} />

          <FieldErrorSummary errors={fe.errors} onFocus={fe.focusFirstInvalid} />

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
