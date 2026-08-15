"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createEquipo, updateEquipo } from "@/actions/inventario";
import {
  CATEGORIAS_EQUIPO,
  CATEGORIA_LABEL,
  CONDICIONES,
  CONDICION_LABEL,
  type EquipoInventario,
} from "@/lib/inventario-shared";

interface Borrador {
  nombre: string;
  codigo: string;
  categoria: string;
  marca: string;
  modelo: string;
  serial: string;
  condicion: string;
  ubicacion: string;
  valor: string;
  fecha_compra: string;
  notas: string;
}

const VACIO: Borrador = {
  nombre: "", codigo: "", categoria: "camara", marca: "", modelo: "", serial: "",
  condicion: "bueno", ubicacion: "", valor: "", fecha_compra: "", notas: "",
};

function desde(e: EquipoInventario): Borrador {
  return {
    nombre: e.nombre,
    codigo: e.codigo ?? "",
    categoria: e.categoria,
    marca: e.marca ?? "",
    modelo: e.modelo ?? "",
    serial: e.serial ?? "",
    condicion: e.condicion,
    ubicacion: e.ubicacion ?? "",
    valor: e.valor != null ? String(e.valor) : "",
    fecha_compra: e.fecha_compra ?? "",
    notas: e.notas ?? "",
  };
}

export function EquipoFormDialog({
  open,
  onOpenChange,
  equipo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipo?: EquipoInventario | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Borrador>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) {
      setForm(equipo ? desde(equipo) : VACIO);
      setErrores({});
    }
  }, [open, equipo]);

  const set = (k: keyof Borrador, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const guardar = () => {
    setErrores({});
    start(async () => {
      const payload = {
        ...form,
        valor: form.valor.trim() === "" ? null : form.valor,
        fecha_compra: form.fecha_compra || null,
      };
      const res = equipo ? await updateEquipo(equipo.id, payload) : await createEquipo(payload);
      if (res.ok) {
        toast.success(res.message);
        onOpenChange(false);
        router.refresh();
      } else {
        setErrores(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{equipo ? "Editar equipo" : "Nuevo equipo"}</DialogTitle>
          <DialogDescription>
            Datos del bien para el inventario. El código es tu placa interna (opcional pero recomendado).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="inv-nombre">Nombre *</Label>
            <Input
              id="inv-nombre"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              placeholder="Cámara Sony A7 IV"
              aria-invalid={Boolean(errores.nombre)}
            />
            {errores.nombre && <p className="mt-1 text-[11px] text-destructive">{errores.nombre}</p>}
          </div>

          <div>
            <Label htmlFor="inv-codigo">Código interno</Label>
            <Input
              id="inv-codigo"
              value={form.codigo}
              onChange={(e) => set("codigo", e.target.value)}
              placeholder="UTL-CAM-001"
              aria-invalid={Boolean(errores.codigo)}
            />
            {errores.codigo && <p className="mt-1 text-[11px] text-destructive">{errores.codigo}</p>}
          </div>

          <div>
            <Label htmlFor="inv-categoria">Categoría</Label>
            <select
              id="inv-categoria"
              value={form.categoria}
              onChange={(e) => set("categoria", e.target.value)}
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
            >
              {CATEGORIAS_EQUIPO.map((c) => (
                <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="inv-marca">Marca</Label>
            <Input id="inv-marca" value={form.marca} onChange={(e) => set("marca", e.target.value)} placeholder="Sony" />
          </div>
          <div>
            <Label htmlFor="inv-modelo">Modelo</Label>
            <Input id="inv-modelo" value={form.modelo} onChange={(e) => set("modelo", e.target.value)} placeholder="A7 IV" />
          </div>
          <div>
            <Label htmlFor="inv-serial">N.º de serie</Label>
            <Input id="inv-serial" value={form.serial} onChange={(e) => set("serial", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="inv-condicion">Condición</Label>
            <select
              id="inv-condicion"
              value={form.condicion}
              onChange={(e) => set("condicion", e.target.value)}
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
            >
              {CONDICIONES.map((c) => (
                <option key={c} value={c}>{CONDICION_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="inv-ubicacion">Ubicación</Label>
            <Input id="inv-ubicacion" value={form.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} placeholder="Bodega / estante" />
          </div>
          <div>
            <Label htmlFor="inv-valor">Valor de reposición (COP)</Label>
            <Input id="inv-valor" type="number" min={0} value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label htmlFor="inv-fecha">Fecha de compra</Label>
            <Input id="inv-fecha" type="date" value={form.fecha_compra} onChange={(e) => set("fecha_compra", e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="inv-notas">Notas</Label>
            <Textarea id="inv-notas" rows={2} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={pending || form.nombre.trim().length < 2}>
            {equipo ? "Guardar cambios" : "Registrar equipo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
