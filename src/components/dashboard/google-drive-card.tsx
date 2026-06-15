"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { HardDrive, FolderTree, CheckCircle2, ExternalLink, RefreshCw, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { disconnectDriveAction, repairDriveTree } from "@/actions/google";
import { DRIVE_TREE, type DriveConfig } from "@/lib/drive-shared";

export function GoogleDriveCard({ status }: { status: DriveConfig }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const g = params.get("google");
    if (g === "connected") { toast.success("Google Drive conectado y carpetas creadas."); setDone(true); router.replace("/dashboard/configuracion"); }
    else if (g === "error") { toast.error("No se pudo conectar Google Drive. Intenta de nuevo."); setDone(true); }
    else if (g === "missing_env") { toast.error("Faltan credenciales de Google en el servidor."); setDone(true); }
  }, [params, done, router]);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <HardDrive className="size-4" /> Google Drive
          </h3>
          {status.connected ? (
            <Badge variant="success" className="gap-1"><CheckCircle2 className="size-3" /> Conectado</Badge>
          ) : (
            <Badge variant="muted">No conectado</Badge>
          )}
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Conecta la cuenta de la campaña una vez. Los archivos de tareas y contactos se guardarán
          en una carpeta <strong>UTL 360</strong> organizada por módulos. Las fotos de perfil/portada
          siguen en almacenamiento rápido.
        </p>

        {status.connected ? (
          <div className="mt-4 space-y-3">
            {status.email && (
              <p className="text-sm">Cuenta: <span className="font-medium">{status.email}</span></p>
            )}
            {status.root_link && (
              <a href={status.root_link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <ExternalLink className="size-3.5" /> Abrir carpeta UTL 360 en Drive
              </a>
            )}
            <div className="flex flex-wrap gap-1.5">
              {DRIVE_TREE.map((f) => (
                <Badge key={f.key} variant="muted" className="gap-1"><FolderTree className="size-3" />{f.name}</Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="outline" size="sm" disabled={pending}
                onClick={() => start(async () => {
                  const r = await repairDriveTree();
                  if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.message);
                })}
              >
                <RefreshCw className="size-4" /> Verificar carpetas
              </Button>
              <Button
                variant="ghost" size="sm" className="text-destructive" disabled={pending}
                onClick={() => start(async () => {
                  const r = await disconnectDriveAction();
                  if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.message);
                })}
              >
                <Unplug className="size-4" /> Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <Button asChild>
              <a href="/api/google/connect"><HardDrive className="size-4" /> Conectar Google Drive</a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
