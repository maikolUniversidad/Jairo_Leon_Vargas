"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, Mail, ShieldCheck, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldErrorSummary, useFieldErrors } from "@/components/ui/field";
import { initials } from "@/lib/utils";
import { profileSchema } from "@/lib/validations";
import type { Profile } from "@/types/database";
import { updateMyProfile, updateMyAvatar } from "@/actions/perfil";
import { uploadAvatar } from "@/lib/upload-avatar";
import { ImageCropper, CROP_PRESETS } from "@/components/dashboard/image-cropper";

const NO_AREA = "__none__";

export function ProfileForm({
  profile,
  email,
  roleLabels,
  areas,
}: {
  profile: Profile | null;
  email: string | null;
  roleLabels: string[];
  areas: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fe = useFieldErrors();

  const [avatar, setAvatar] = useState(profile?.avatar_url ?? "");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [cargo, setCargo] = useState(profile?.cargo ?? "");
  const [documento, setDocumento] = useState(profile?.documento ?? "");
  const [direccion, setDireccion] = useState(profile?.direccion ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [areaId, setAreaId] = useState(profile?.area_id ?? NO_AREA);
  const [fechaIngreso, setFechaIngreso] = useState(
    profile?.fecha_ingreso ? profile.fecha_ingreso.slice(0, 10) : "",
  );

  async function pickAvatar(file: File) {
    if (!profile) return;
    setUploading(true);
    try {
      const up = await uploadAvatar(profile.id, file);
      if (!up.ok || !up.url) { toast.error(up.message ?? "No se pudo subir."); return; }
      setAvatar(up.url);
      setCropFile(null);
      const res = await updateMyAvatar(up.url);
      if (res.ok) { toast.success("Foto actualizada."); router.refresh(); }
      else toast.error(res.message);
    } finally {
      setUploading(false);
    }
  }

  function save() {
    const payload = {
      full_name: fullName,
      phone,
      cargo,
      documento,
      direccion,
      bio,
      area_id: areaId === NO_AREA ? "" : areaId,
      fecha_ingreso: fechaIngreso,
      avatar_url: avatar,
    };
    // Mismo esquema que el server action: señala el campo exacto al instante.
    if (!fe.validate(profileSchema, payload)) return;

    start(async () => {
      const res = await updateMyProfile(payload);
      if (res.ok) { toast.success(res.message); fe.clear(); router.refresh(); }
      else if (!fe.fromResult(res)) toast.error(res.message);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Tarjeta de identidad */}
      <Card className="lg:col-span-1">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="relative">
            {avatar ? (
              <Image
                src={avatar}
                alt={fullName || "Foto de perfil"}
                width={112}
                height={112}
                unoptimized
                className="size-28 rounded-full object-cover ring-2 ring-primary/20"
              />
            ) : (
              <span className="flex size-28 items-center justify-center rounded-full bg-primary text-3xl font-black text-white">
                {initials(fullName || email)}
              </span>
            )}
            <label
              className="absolute bottom-0 right-0 flex size-9 cursor-pointer items-center justify-center rounded-full border bg-background shadow hover:bg-muted"
              title="Cambiar foto"
            >
              <Camera className="size-4" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setCropFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div>
            <p className="text-lg font-bold">{fullName || "Sin nombre"}</p>
            {cargo && <p className="text-sm text-muted-foreground">{cargo}</p>}
          </div>
          {uploading && <p className="text-xs text-muted-foreground">Subiendo foto…</p>}
          <div className="flex flex-wrap justify-center gap-1.5">
            {roleLabels.length === 0 && <Badge variant="muted">Sin rol</Badge>}
            {roleLabels.map((r) => (
              <Badge key={r} variant="secondary" className="gap-1">
                <ShieldCheck className="size-3" /> {r}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-4" /> {email}
          </div>
          <Badge variant={profile?.is_active ? "success" : "muted"}>
            {profile?.is_active ? "Cuenta activa" : "Cuenta inactiva"}
          </Badge>
        </CardContent>
      </Card>

      {/* Formulario de datos */}
      <Card className="lg:col-span-2">
        <CardContent className="space-y-4 p-6">
          <div ref={fe.containerRef} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" required className="sm:col-span-2" {...fe.field("full_name")}>
              <Input id="full_name" value={fullName} onChange={(e) => { fe.clear("full_name"); setFullName(e.target.value); }} autoComplete="name" aria-invalid={!!fe.errors.full_name} />
            </Field>
            <Field label="Cargo" {...fe.field("cargo")}>
              <Input id="cargo" placeholder="Coordinador, gestor…" value={cargo} onChange={(e) => { fe.clear("cargo"); setCargo(e.target.value); }} aria-invalid={!!fe.errors.cargo} />
            </Field>
            <Field label="Documento" {...fe.field("documento")}>
              <Input id="documento" inputMode="numeric" value={documento} onChange={(e) => { fe.clear("documento"); setDocumento(e.target.value); }} aria-invalid={!!fe.errors.documento} />
            </Field>
            <Field label="Teléfono" {...fe.field("phone")}>
              <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => { fe.clear("phone"); setPhone(e.target.value); }} autoComplete="tel" aria-invalid={!!fe.errors.phone} />
            </Field>
            <Field label="Área" {...fe.field("area_id")}>
              <Select value={areaId} onValueChange={(v) => { fe.clear("area_id"); setAreaId(v); }}>
                <SelectTrigger><SelectValue placeholder="Sin área" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_AREA}>Sin área</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Dirección" className="sm:col-span-2" {...fe.field("direccion")}>
              <Input id="direccion" value={direccion} onChange={(e) => { fe.clear("direccion"); setDireccion(e.target.value); }} aria-invalid={!!fe.errors.direccion} />
            </Field>
            <Field label="Fecha de ingreso" {...fe.field("fecha_ingreso")}>
              <Input id="fecha_ingreso" type="date" value={fechaIngreso} onChange={(e) => { fe.clear("fecha_ingreso"); setFechaIngreso(e.target.value); }} aria-invalid={!!fe.errors.fecha_ingreso} />
            </Field>
            <Field label="Sobre mí" className="sm:col-span-2" {...fe.field("bio")}>
              <Textarea id="bio" rows={3} value={bio} onChange={(e) => { fe.clear("bio"); setBio(e.target.value); }} aria-invalid={!!fe.errors.bio} />
            </Field>
          </div>
          <FieldErrorSummary errors={fe.errors} onFocus={fe.focusFirstInvalid} />
          <div className="flex justify-end">
            <Button className="w-full sm:w-auto" onClick={save} disabled={pending || uploading}>
              <Save className="size-4" /> {pending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ImageCropper
        open={!!cropFile}
        file={cropFile}
        target={CROP_PRESETS.avatar}
        busy={uploading}
        onCancel={() => setCropFile(null)}
        onConfirm={pickAvatar}
      />
    </div>
  );
}
