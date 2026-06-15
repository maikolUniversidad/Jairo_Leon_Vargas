"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { ALL_MODULES, MODULE_LABELS, ROLES, ROLE_LABELS } from "@/types/roles";
import {
  setPermission,
  createRole,
  deleteRole,
  type RoleRow,
  type PermissionRow,
} from "@/actions/roles";

type PermField = "can_view" | "can_create" | "can_edit" | "can_delete";
const FIELDS: { key: PermField; label: string }[] = [
  { key: "can_view", label: "Ver" },
  { key: "can_create", label: "Crear" },
  { key: "can_edit", label: "Editar" },
  { key: "can_delete", label: "Eliminar" },
];

export function RolesManager({
  roles,
  permissions,
}: {
  roles: RoleRow[];
  permissions: PermissionRow[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [selectedKey, setSelectedKey] = useState(roles[0]?.key ?? "");

  // Estado local de la matriz para feedback inmediato
  const [matrix, setMatrix] = useState<Record<string, PermissionRow>>(() => {
    const m: Record<string, PermissionRow> = {};
    for (const p of permissions) m[`${p.role_key}:${p.module}`] = { ...p };
    return m;
  });

  const role = roles.find((r) => r.key === selectedKey) ?? null;

  const get = (module: string): PermissionRow =>
    matrix[`${selectedKey}:${module}`] ?? {
      role_key: selectedKey,
      module,
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
    };

  function toggle(module: string, field: PermField, value: boolean) {
    const key = `${selectedKey}:${module}`;
    const next = { ...get(module), [field]: value };
    // Si quitas "ver", quita los demás; si activas crear/editar/eliminar, activa "ver".
    if (field === "can_view" && !value) {
      next.can_create = false; next.can_edit = false; next.can_delete = false;
    }
    if (field !== "can_view" && value) next.can_view = true;
    setMatrix((prev) => ({ ...prev, [key]: next }));
    start(async () => {
      const res = await setPermission(selectedKey, module, {
        can_view: next.can_view,
        can_create: next.can_create,
        can_edit: next.can_edit,
        can_delete: next.can_delete,
      });
      if (!res.ok) { toast.error(res.message); router.refresh(); }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      {/* Lista de roles */}
      <div className="lg:col-span-1">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Roles</h3>
          <CreateRoleDialog onCreated={() => router.refresh()} />
        </div>
        <div className="space-y-1">
          {roles.map((r) => (
            <button
              key={r.key}
              onClick={() => setSelectedKey(r.key)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                selectedKey === r.key ? "border-primary bg-primary/5" : "hover:bg-muted",
              )}
            >
              <span className="font-medium">{r.label}</span>
              {r.is_system ? (
                <Badge variant="muted">sistema</Badge>
              ) : (
                <Badge variant="secondary">propio</Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Matriz de permisos */}
      <div className="lg:col-span-3">
        {role && (
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="size-4" /> {role.label}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {role.descripcion ?? "Permisos por módulo"} · nivel de datos: {role.base_role}
                  </p>
                </div>
                {!role.is_system && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() =>
                      start(async () => {
                        const res = await deleteRole(role.key);
                        if (res.ok) { toast.success(res.message); setSelectedKey(roles[0]?.key ?? ""); router.refresh(); }
                        else toast.error(res.message);
                      })
                    }
                  >
                    <Trash2 className="size-4" /> Eliminar rol
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-semibold">Módulo</th>
                      {FIELDS.map((f) => (
                        <th key={f.key} className="px-2 py-2 text-center font-semibold">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_MODULES.map((m) => {
                      const p = get(m);
                      return (
                        <tr key={m} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{MODULE_LABELS[m]}</td>
                          {FIELDS.map((f) => (
                            <td key={f.key} className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                className="size-4 rounded border-input accent-[var(--primary)]"
                                checked={p[f.key]}
                                disabled={role.is_system && role.key === "super_admin"}
                                onChange={(e) => toggle(m, f.key, e.target.checked)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Los cambios se guardan al instante. “Ver” es la base: sin ella no aplican los demás.
                Estos permisos controlan qué módulos ve cada rol en el panel.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CreateRoleDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [baseRole, setBaseRole] = useState<string>("consulta");
  const [pending, start] = useTransition();

  const autoKey = useMemo(
    () => key || label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
    [key, label],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="size-4" /> Rol</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo rol personalizado</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="r-label">Nombre *</Label>
            <Input id="r-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="p. ej. Prensa Junior" />
          </div>
          <div>
            <Label htmlFor="r-key">Clave</Label>
            <Input id="r-key" value={autoKey} onChange={(e) => setKey(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Identificador único (minúsculas/guion bajo).</p>
          </div>
          <div>
            <Label htmlFor="r-desc">Descripción</Label>
            <Input id="r-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div>
            <Label>Nivel de datos base (seguridad)</Label>
            <Select value={baseRole} onValueChange={setBaseRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Define a qué datos puede acceder (RLS). Los permisos de “ver/crear/editar” por módulo
              se ajustan después en la matriz.
            </p>
          </div>
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => {
              if (!label.trim()) return toast.error("Escribe un nombre.");
              start(async () => {
                const res = await createRole({ key: autoKey, label, descripcion, base_role: baseRole });
                if (res.ok) { toast.success(res.message); setLabel(""); setKey(""); setDescripcion(""); setOpen(false); onCreated(); }
                else toast.error(res.message);
              });
            }}
          >
            {pending ? "Creando…" : "Crear rol"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
