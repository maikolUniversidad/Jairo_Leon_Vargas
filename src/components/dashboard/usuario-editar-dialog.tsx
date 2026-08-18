"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, KeyRound, Loader2, Mail, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Field, useFieldErrors } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { uploadAvatar } from "@/lib/upload-avatar";
import { initials } from "@/lib/utils";
import {
  sendPasswordRecovery,
  setUserPassword,
  updateUserProfile,
  type ManagedUser,
} from "@/actions/usuarios";

/**
 * Edición de la ficha de un usuario desde Configuración: nombre, teléfono,
 * cargo, foto y contraseña.
 *
 * La contraseña anterior no se puede consultar —Supabase guarda un hash de una
 * sola vía—, así que aquí solo se puede REEMPLAZAR. Por eso se ofrece primero
 * el correo de recuperación: es la vía en la que la clave no pasa por nadie más.
 */
export function UsuarioEditarDialog({
  usuario,
  abierto,
  onCerrar,
}: {
  usuario: ManagedUser | null;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const fe = useFieldErrors();
  const [, start] = useTransition();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cargo, setCargo] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Se rellena cuando cambia el usuario, no en cada render: si fuera un efecto
  // sobre el objeto, cada refresco del listado borraría lo que se esté editando.
  const [cargadoPara, setCargadoPara] = useState<string | null>(null);
  if (usuario && cargadoPara !== usuario.id) {
    setCargadoPara(usuario.id);
    setFullName(usuario.full_name ?? "");
    setPhone(usuario.phone ?? "");
    setCargo(usuario.cargo ?? "");
    setAvatarUrl(usuario.avatar_url);
    setPassword("");
  }

  if (!usuario) return null;

  const elegirFoto = async (file: File) => {
    setSubiendo(true);
    const res = await uploadAvatar(usuario.id, file);
    setSubiendo(false);
    if (!res.ok || !res.url) {
      toast.error(res.message ?? "No se pudo subir la foto.");
      return;
    }
    // Se ve de una, pero no queda guardada hasta darle a «Guardar ficha».
    setAvatarUrl(res.url);
    toast.success("Foto lista. Guarda la ficha para aplicarla.");
  };

  const guardarFicha = () =>
    start(async () => {
      setGuardando(true);
      const res = await updateUserProfile(usuario.id, {
        full_name: fullName,
        phone,
        cargo,
        avatar_url: avatarUrl ?? "",
      });
      setGuardando(false);
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
        onCerrar();
        return;
      }
      if (!fe.fromResult(res)) toast.error(res.message);
    });

  const cambiarClave = () =>
    start(async () => {
      const res = await setUserPassword(usuario.id, password);
      if (res.ok) {
        toast.success(res.message);
        setPassword("");
        return;
      }
      if (!fe.fromResult(res)) toast.error(res.message);
    });

  const mandarCorreo = () =>
    start(async () => {
      const res = await sendPasswordRecovery(usuario.email ?? "");
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>{usuario.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4" ref={fe.containerRef}>
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={fullName || "Usuario"}
                width={64}
                height={64}
                unoptimized
                className="size-16 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                {initials(fullName || usuario.email)}
              </span>
            )}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void elegirFoto(f);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={subiendo}
              >
                {subiendo ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Camera className="mr-1.5 size-4" />
                )}
                {subiendo ? "Subiendo…" : "Cambiar foto"}
              </Button>
              <p className="mt-1 text-[11px] text-muted-foreground">JPG o PNG, hasta 5 MB.</p>
            </div>
          </div>

          <Field label="Nombre completo" required {...fe.field("full_name")}>
            <Input
              value={fullName}
              onChange={(e) => {
                fe.clear("full_name");
                setFullName(e.target.value);
              }}
              aria-invalid={!!fe.errors.full_name}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Teléfono">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Cargo">
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} />
            </Field>
          </div>

          <Button className="w-full" onClick={guardarFicha} disabled={guardando}>
            <Save className="mr-1.5 size-4" /> {guardando ? "Guardando…" : "Guardar ficha"}
          </Button>

          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Contraseña</p>
            <p className="text-[11px] text-muted-foreground">
              La actual no se puede consultar: se guarda cifrada de una sola vía. Solo se puede
              reemplazar.
            </p>

            <Button variant="outline" size="sm" className="w-full" onClick={mandarCorreo}>
              <Mail className="mr-1.5 size-4" /> Enviar correo de recuperación
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Preferible: la persona pone su propia clave y no pasa por nadie más.
            </p>

            <div className="flex items-start gap-2 pt-1">
              <div className="flex-1">
                <Input
                  type="text"
                  value={password}
                  onChange={(e) => {
                    fe.clear("password");
                    setPassword(e.target.value);
                  }}
                  placeholder="…o asignar una nueva"
                  aria-label="Contraseña nueva"
                  aria-invalid={!!fe.errors.password}
                />
                {fe.errors.password && (
                  <p className="mt-1 text-[11px] text-destructive">{fe.errors.password}</p>
                )}
              </div>
              <Button variant="outline" onClick={cambiarClave} disabled={password.length < 6}>
                <KeyRound className="size-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cambiarla cierra las sesiones abiertas de esa persona.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
