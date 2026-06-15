"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { taskSchema, type TaskInput } from "@/lib/validations";
import { CONTEXTO_LABELS } from "@/types/database";
import { createTask } from "@/actions/tareas";

interface PersonOption { id: string; full_name: string | null; email: string | null }

function PeoplePicker({
  people,
  selected,
  onToggle,
  empty,
}: {
  people: PersonOption[];
  selected: string[];
  onToggle: (id: string) => void;
  empty?: string;
}) {
  if (people.length === 0)
    return <p className="text-xs text-muted-foreground">{empty ?? "Sin personas."}</p>;
  return (
    <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border p-2">
      {people.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors",
              on ? "bg-primary/10 text-foreground" : "hover:bg-muted",
            )}
          >
            <input type="checkbox" readOnly checked={on} className="size-3.5" />
            {p.full_name || p.email || p.id.slice(0, 8)}
          </button>
        );
      })}
    </div>
  );
}

export function TaskCreateDialog({
  profiles = [],
  workspaces = [],
  defaultWorkspaceId,
}: {
  profiles?: PersonOption[];
  workspaces?: { id: string; nombre: string }[];
  defaultWorkspaceId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [responsables, setResponsables] = useState<string[]>([]);
  const [participantes, setParticipantes] = useState<string[]>([]);
  const { register, handleSubmit, setValue, reset, watch, formState } =
    useForm<TaskInput>({
      resolver: zodResolver(taskSchema),
      defaultValues: {
        prioridad: "media",
        estado: "pendiente",
        contexto_operativo: "interno",
        workspace_id: defaultWorkspaceId ?? "",
      },
    });

  const contexto = watch("contexto_operativo");
  const UNASSIGNED = "__none__";

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function resetAll() {
    reset();
    setResponsables([]);
    setParticipantes([]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> Nueva tarea</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) =>
            start(async () => {
              const res = await createTask({ ...values, responsables, participantes });
              if (res.ok) {
                toast.success(res.message);
                resetAll();
                setOpen(false);
              } else {
                toast.error(res.message);
              }
            }),
          )}
        >
          <div>
            <Label htmlFor="t-titulo">Título *</Label>
            <Input id="t-titulo" {...register("titulo")} />
            {formState.errors.titulo && (
              <p className="mt-1 text-xs text-destructive">{formState.errors.titulo.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="t-desc">Descripción</Label>
            <Textarea id="t-desc" rows={2} {...register("descripcion")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block">Responsables</Label>
              <PeoplePicker people={profiles} selected={responsables} onToggle={(id) => toggle(responsables, setResponsables, id)} />
            </div>
            <div>
              <Label className="mb-1 block">Participantes</Label>
              <PeoplePicker people={profiles} selected={participantes} onToggle={(id) => toggle(participantes, setParticipantes, id)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Workspace</Label>
              <Select
                defaultValue={defaultWorkspaceId ?? UNASSIGNED}
                onValueChange={(v) => setValue("workspace_id", v === UNASSIGNED ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="General" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>General (sin workspace)</SelectItem>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="t-fecha">Fecha límite</Label>
              <Input id="t-fecha" type="date" {...register("fecha_limite")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Prioridad</Label>
              <Select defaultValue="media" onValueChange={(v) => setValue("prioridad", v as TaskInput["prioridad"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contexto operativo</Label>
              <Select
                defaultValue="interno"
                onValueChange={(v) => setValue("contexto_operativo", v as TaskInput["contexto_operativo"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTEXTO_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {contexto === "campana" && (
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              ⚠️ Contenido de <strong>campaña</strong>: no lo mezcles con gestión institucional.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creando…" : "Crear tarea"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
