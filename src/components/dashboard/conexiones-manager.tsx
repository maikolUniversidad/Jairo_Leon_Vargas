"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plug, CheckCircle2, XCircle, RefreshCw, Trash2, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import {
  saveConnection,
  checkConnection,
  disconnectConnection,
  type ConnectionView,
} from "@/actions/conexiones";

export function ConexionesManager({ connections }: { connections: ConnectionView[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <Share2 className="size-4" /> Conexiones de redes y fuentes
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecta las APIs de redes y noticias para el monitoreo. Guarda la credencial y
          confirma la conexión. Las noticias de Google News funcionan sin conexión.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {connections.map((c) => (
          <ConnectionCard key={c.provider.key} conn={c} />
        ))}
      </div>
    </div>
  );
}

function ConnectionCard({ conn }: { conn: ConnectionView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState<Record<string, string>>({});
  const { provider, status, hasSecret } = conn;

  function save() {
    if (provider.fields.every((f) => !(values[f.name] ?? "").trim())) {
      return toast.error("Ingresa la credencial.");
    }
    start(async () => {
      const res = await saveConnection(provider.key, values);
      if (res.ok) { toast.success(res.message); setValues({}); router.refresh(); }
      else toast.error(res.message);
    });
  }
  function check() {
    start(async () => {
      const res = await checkConnection(provider.key);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      router.refresh();
    });
  }
  function remove() {
    if (!confirm(`¿Eliminar la conexión con ${provider.label}?`)) return;
    start(async () => {
      const res = await disconnectConnection(provider.key);
      if (res.ok) { toast.success(res.message); router.refresh(); } else toast.error(res.message);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-medium">
            <Plug className="size-4 text-muted-foreground" /> {provider.label}
          </span>
          {status.connected ? (
            <Badge variant="success" className="gap-1"><CheckCircle2 className="size-3" /> Conectado</Badge>
          ) : hasSecret ? (
            <Badge variant="warning" className="gap-1"><XCircle className="size-3" /> Sin confirmar</Badge>
          ) : (
            <Badge variant="muted">No conectado</Badge>
          )}
        </div>

        {provider.help && <p className="text-xs text-muted-foreground">{provider.help}</p>}
        {!provider.testable && (
          <p className="text-xs text-amber-600">Sin verificación automática (se guarda la credencial).</p>
        )}

        {provider.fields.map((f) => (
          <div key={f.name}>
            <Label className="text-xs">{f.label}</Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder={hasSecret ? "•••••••• (guardado — reingresa para cambiar)" : f.placeholder ?? ""}
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            />
          </div>
        ))}

        {status.detail && (
          <p className="text-xs text-muted-foreground">
            {status.detail}
            {status.checked_at && ` · ${formatDate(status.checked_at, { dateStyle: "short", timeStyle: "short" })}`}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? "Guardando…" : "Guardar y confirmar"}
          </Button>
          {hasSecret && (
            <Button size="sm" variant="outline" onClick={check} disabled={pending}>
              <RefreshCw className="size-4" /> Probar
            </Button>
          )}
          {hasSecret && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={remove} disabled={pending}>
              <Trash2 className="size-4" /> Quitar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
