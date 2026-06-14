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
import { taskSchema, type TaskInput } from "@/lib/validations";
import { CONTEXTO_LABELS } from "@/types/database";
import { createTask } from "@/actions/tareas";

export function TaskCreateDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { register, handleSubmit, setValue, reset, watch, formState } =
    useForm<TaskInput>({
      resolver: zodResolver(taskSchema),
      defaultValues: { prioridad: "media", estado: "pendiente", contexto_operativo: "interno" },
    });

  const contexto = watch("contexto_operativo");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> Nueva tarea</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) =>
            start(async () => {
              const res = await createTask(values);
              if (res.ok) {
                toast.success(res.message);
                reset();
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
            <Textarea id="t-desc" rows={3} {...register("descripcion")} />
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
              <Label htmlFor="t-fecha">Fecha límite</Label>
              <Input id="t-fecha" type="date" {...register("fecha_limite")} />
            </div>
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
            {contexto === "campana" && (
              <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                ⚠️ Contenido de <strong>campaña</strong>: no lo mezcles con gestión
                institucional. Se registrará y reportará por separado.
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creando…" : "Crear tarea"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
