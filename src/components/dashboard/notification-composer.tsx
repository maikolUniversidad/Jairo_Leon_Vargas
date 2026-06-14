"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES, ROLE_LABELS } from "@/types/roles";
import { sendNotification, type SendInput } from "@/actions/notificaciones";

const CANALES: { value: SendInput["canales"][number]; label: string; hint?: string }[] = [
  { value: "in_app", label: "En la plataforma", hint: "siempre activo" },
  { value: "email", label: "Correo (Resend)", hint: "requiere RESEND_API_KEY" },
  { value: "push", label: "Push (FCM)", hint: "por configurar" },
  { value: "whatsapp", label: "WhatsApp", hint: "por configurar" },
];

const TIPOS = [
  { value: "info", label: "Información" },
  { value: "exito", label: "Éxito" },
  { value: "advertencia", label: "Advertencia" },
  { value: "alerta", label: "Alerta" },
];

interface UserOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

export function NotificationComposer({ users }: { users: UserOption[] }) {
  const [pending, start] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [tipo, setTipo] = useState("info");
  const [url, setUrl] = useState("");
  const [canales, setCanales] = useState<SendInput["canales"]>(["in_app"]);
  const [audienciaTipo, setAudienciaTipo] = useState<SendInput["audiencia_tipo"]>("todos");
  const [audienciaValor, setAudienciaValor] = useState("");

  function toggleCanal(c: SendInput["canales"][number]) {
    setCanales((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function submit() {
    if (!titulo.trim()) return toast.error("Escribe un título.");
    if (canales.length === 0) return toast.error("Selecciona al menos un canal.");
    if (audienciaTipo !== "todos" && !audienciaValor)
      return toast.error("Elige el destinatario.");

    start(async () => {
      const res = await sendNotification({
        titulo,
        cuerpo,
        tipo,
        url,
        canales,
        audiencia_tipo: audienciaTipo,
        audiencia_valor: audienciaValor || undefined,
      });
      if (res.ok) {
        toast.success(res.message);
        setTitulo("");
        setCuerpo("");
        setUrl("");
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <Label htmlFor="n-titulo">Título *</Label>
          <Input id="n-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="n-cuerpo">Mensaje</Label>
          <Textarea id="n-cuerpo" rows={3} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="n-url">Enlace (opcional)</Label>
            <Input id="n-url" placeholder="/dashboard/solicitudes" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Canales</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {CANALES.map((c) => (
              <label
                key={c.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={canales.includes(c.value)}
                  onChange={() => toggleCanal(c.value)}
                />
                <span className="font-medium">{c.label}</span>
                {c.hint && <span className="ml-auto text-[11px] text-muted-foreground">{c.hint}</span>}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Destinatarios</Label>
            <Select
              value={audienciaTipo}
              onValueChange={(v) => {
                setAudienciaTipo(v as SendInput["audiencia_tipo"]);
                setAudienciaValor("");
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo el equipo</SelectItem>
                <SelectItem value="rol">Por rol</SelectItem>
                <SelectItem value="usuario">Un usuario</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {audienciaTipo === "rol" && (
            <div>
              <Label>Rol</Label>
              <Select value={audienciaValor} onValueChange={setAudienciaValor}>
                <SelectTrigger><SelectValue placeholder="Selecciona rol" /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {audienciaTipo === "usuario" && (
            <div>
              <Label>Usuario</Label>
              <Select value={audienciaValor} onValueChange={setAudienciaValor}>
                <SelectTrigger><SelectValue placeholder="Selecciona usuario" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email || u.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Button onClick={submit} disabled={pending} className="w-full sm:w-auto">
          <Send className="size-4" /> {pending ? "Enviando…" : "Enviar notificación"}
        </Button>
      </CardContent>
    </Card>
  );
}
