"use client";

import { useMemo, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import type { AuditTrail, AuditEntry } from "@/actions/auditoria";

const ALL = "__all__";

const ACCION_LABEL: Record<string, string> = {
  INSERT: "Creación",
  UPDATE: "Actualización",
  DELETE: "Eliminación",
  login: "Inicio de sesión",
  subida: "Subida",
  descarga: "Descarga",
  vista: "Vista",
  exporta: "Exportación",
};

function tone(e: AuditEntry): "muted" | "success" | "warning" | "danger" | "secondary" {
  if (e.accion === "DELETE") return "danger";
  if (e.accion === "INSERT" || e.accion === "subida") return "success";
  if (e.accion === "UPDATE") return "warning";
  if (e.fuente === "actividad") return "secondary";
  return "muted";
}

export function AuditoriaView({ trail }: { trail: AuditTrail }) {
  const [q, setQ] = useState("");
  const [entidad, setEntidad] = useState(ALL);
  const [accion, setAccion] = useState(ALL);
  const [fuente, setFuente] = useState(ALL);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return trail.entries.filter((e) => {
      if (entidad !== ALL && e.entidad !== entidad) return false;
      if (accion !== ALL && e.accion !== accion) return false;
      if (fuente !== ALL && e.fuente !== fuente) return false;
      if (s) {
        const hay = [e.actor_nombre, e.entidad, e.accion, e.detalle, e.entidad_id]
          .filter(Boolean).some((v) => v!.toLowerCase().includes(s));
        if (!hay) return false;
      }
      return true;
    });
  }, [trail.entries, q, entidad, accion, fuente]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Input placeholder="Buscar (usuario, entidad, detalle…)" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-64" />
          <Select value={entidad} onValueChange={setEntidad}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Entidad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las entidades</SelectItem>
              {trail.entidades.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={accion} onValueChange={setAccion}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Acción" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las acciones</SelectItem>
              {trail.acciones.map((a) => <SelectItem key={a} value={a}>{ACCION_LABEL[a] ?? a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fuente} onValueChange={setFuente}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Fuente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Mutaciones y actividad</SelectItem>
              <SelectItem value="mutacion">Cambios de datos</SelectItem>
              <SelectItem value="actividad">Actividad (accesos/archivos)</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length} registro(s)</span>
          <Button
            variant="outline" size="sm" className="ml-auto"
            onClick={() => downloadCsv(
              "auditoria",
              ["Fecha", "Usuario", "Acción", "Entidad", "ID/Detalle", "Fuente"],
              filtered.map((e) => [
                formatDate(e.created_at, { dateStyle: "short", timeStyle: "medium" }),
                e.actor_nombre, ACCION_LABEL[e.accion] ?? e.accion, e.entidad ?? "", e.detalle ?? e.entidad_id ?? "", e.fuente,
              ]),
            )}
          >
            <Download className="size-4" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
          <ShieldCheck className="size-10 opacity-40" />
          <p>Sin registros para los filtros actuales.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(e.created_at, { dateStyle: "short", timeStyle: "short" })}
                    </TableCell>
                    <TableCell className="text-sm">{e.actor_nombre}</TableCell>
                    <TableCell><Badge variant={tone(e)}>{ACCION_LABEL[e.accion] ?? e.accion}</Badge></TableCell>
                    <TableCell className="text-sm">{e.entidad ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {e.detalle ?? e.entidad_id ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
