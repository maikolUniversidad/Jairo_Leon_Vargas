"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, Mail, ShieldCheck, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { initials } from "@/lib/utils";
import type { Profile } from "@/types/database";
import { updateMyProfile, updateMyAvatar } from "@/actions/perfil";
import { uploadAvatar } from "@/lib/upload-avatar";

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

  const [avatar, setAvatar] = useState(profile?.avatar_url ?? "");
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
      const res = await updateMyAvatar(up.url);
      if (res.ok) { toast.success("Foto actualizada."); router.refresh(); }
      else toast.error(res.message);
    } finally {
      setUploading(false);
    }
  }

  function save() {
    start(async () => {
      const res = await updateMyProfile({
        full_name: fullName,
        phone,
        cargo,
        documento,
        direccion,
        bio,
        area_id: areaId === NO_AREA ? "" : areaId,
        fecha_ingreso: fechaIngreso,
        avatar_url: avatar,
      });
      if (res.ok) { toast.success(res.message); router.refresh(); }
      else toast.error(res.message);
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
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickAvatar(f);
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="p-name">Nombre completo *</Label>
              <Input id="p-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-cargo">Cargo</Label>
              <Input id="p-cargo" placeholder="Coordinador, gestor…" value={cargo} onChange={(e) => setCargo(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-doc">Documento</Label>
              <Input id="p-doc" value={documento} onChange={(e) => setDocumento(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-phone">Teléfono</Label>
              <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Área</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger><SelectValue placeholder="Sin área" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_AREA}>Sin área</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="p-dir">Dirección</Label>
              <Input id="p-dir" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-fecha">Fecha de ingreso</Label>
              <Input id="p-fecha" type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="p-bio">Sobre mí</Label>
              <Textarea id="p-bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={pending || uploading}>
              <Save className="size-4" /> {pending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
