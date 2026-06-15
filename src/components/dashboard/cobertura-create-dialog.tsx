"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

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
import { createCobertura } from "@/actions/coberturas";

export function CoberturaCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [f, setF] = useState({ nombre: "", descripcion: "", fecha: "", lugar: "" });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> Nueva cobertura</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nueva cobertura</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre *</Label>
            <Input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej. Recorrido Kennedy 14 jun" />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea rows={2} value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} />
            </div>
            <div>
              <Label>Lugar</Label>
              <Input value={f.lugar} onChange={(e) => set("lugar", e.target.value)} />
            </div>
          </div>
          <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            Se creará una carpeta en Google Drive con el nombre de la cobertura y subcarpetas
            <strong> Contenido Crudo</strong>, <strong>Editado</strong> y <strong>Aprobado</strong>.
          </p>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => {
              if (!f.nombre.trim()) return toast.error("Escribe el nombre.");
              start(async () => {
                const res = await createCobertura(f);
                if (res.ok && res.data) {
                  toast.success(res.message);
                  setOpen(false);
                  router.push(`/dashboard/comunicaciones/coberturas/${res.data.id}`);
                } else toast.error(res.message);
              });
            }}
          >
            {pending ? "Creando…" : "Crear cobertura"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
