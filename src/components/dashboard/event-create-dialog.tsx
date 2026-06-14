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
import { eventCreateSchema, type EventCreateInput } from "@/lib/validations";
import { createEvent } from "@/actions/eventos";

export function EventCreateDialog({ defaultDate }: { defaultDate?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { register, handleSubmit, setValue, reset, formState } =
    useForm<EventCreateInput>({
      resolver: zodResolver(eventCreateSchema),
      defaultValues: {
        modalidad: "presencial",
        visibilidad: "interna",
        estado: "confirmado",
        contexto_operativo: "comunitario",
        fecha_inicio: defaultDate ?? "",
      },
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> Nuevo evento</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo evento</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) =>
            start(async () => {
              const res = await createEvent(values);
              if (res.ok) { toast.success(res.message); reset(); setOpen(false); }
              else toast.error(res.message);
            }),
          )}
        >
          <div>
            <Label htmlFor="e-titulo">Título *</Label>
            <Input id="e-titulo" {...register("titulo")} />
            {formState.errors.titulo && (
              <p className="mt-1 text-xs text-destructive">{formState.errors.titulo.message}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="e-inicio">Inicio *</Label>
              <Input id="e-inicio" type="datetime-local" {...register("fecha_inicio")} />
              {formState.errors.fecha_inicio && (
                <p className="mt-1 text-xs text-destructive">{formState.errors.fecha_inicio.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="e-fin">Fin</Label>
              <Input id="e-fin" type="datetime-local" {...register("fecha_fin")} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="e-tipo">Tipo</Label>
              <Input id="e-tipo" placeholder="Reunión, recorrido…" {...register("tipo")} />
            </div>
            <div>
              <Label htmlFor="e-lugar">Lugar</Label>
              <Input id="e-lugar" {...register("lugar")} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Modalidad</Label>
              <Select defaultValue="presencial" onValueChange={(v) => setValue("modalidad", v as EventCreateInput["modalidad"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="mixta">Mixta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Visibilidad</Label>
              <Select defaultValue="interna" onValueChange={(v) => setValue("visibilidad", v as EventCreateInput["visibilidad"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interna">Interna</SelectItem>
                  <SelectItem value="publica">Pública (agenda)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select defaultValue="confirmado" onValueChange={(v) => setValue("estado", v as EventCreateInput["estado"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="reprogramado">Reprogramado</SelectItem>
                  <SelectItem value="realizado">Realizado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="e-link">Link de reunión</Label>
            <Input id="e-link" placeholder="https://…" {...register("link_reunion")} />
          </div>
          <div>
            <Label htmlFor="e-desc">Descripción</Label>
            <Textarea id="e-desc" rows={3} {...register("descripcion")} />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creando…" : "Crear evento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
