"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { UserPlus, Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsuarioEditarDialog } from "@/components/dashboard/usuario-editar-dialog";
import { Badge } from "@/components/ui/badge";
import { Field, FieldErrorSummary, useFieldErrors } from "@/components/ui/field";
import { initials } from "@/lib/utils";
import { newUserSchema } from "@/lib/validations";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createUser,
  setUserRole,
  toggleUserActive,
  type ManagedUser,
} from "@/actions/usuarios";
import type { RoleRow } from "@/actions/roles";

export function UsuariosManager({
  users,
  roles,
}: {
  users: ManagedUser[];
  roles: RoleRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fe = useFieldErrors();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState(roles[0]?.key ?? "");
  /** Usuario que se está editando en el diálogo. */
  const [editando, setEditando] = useState<ManagedUser | null>(null);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <UserPlus className="size-4" /> Crear usuario
          </h3>
          <div ref={fe.containerRef} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Nombre" required {...fe.field("full_name")}>
              <Input id="full_name" value={fullName} onChange={(e) => { fe.clear("full_name"); setFullName(e.target.value); }} aria-invalid={!!fe.errors.full_name} />
            </Field>
            <Field label="Correo" required {...fe.field("email")}>
              <Input id="email" type="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => { fe.clear("email"); setEmail(e.target.value); }} aria-invalid={!!fe.errors.email} />
            </Field>
            <Field label="Contraseña" required hint="Mínimo 6 caracteres" {...fe.field("password")}>
              <Input id="password" type="text" value={password} onChange={(e) => { fe.clear("password"); setPassword(e.target.value); }} aria-invalid={!!fe.errors.password} />
            </Field>
            <Field label="Rol" {...fe.field("role_key")}>
              <Select value={roleKey} onValueChange={(v) => { fe.clear("role_key"); setRoleKey(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <FieldErrorSummary className="mt-3" errors={fe.errors} onFocus={fe.focusFirstInvalid} />
          <Button
            className="mt-4 w-full sm:w-auto"
            disabled={pending}
            onClick={() => {
              const payload = { email, password, full_name: fullName, role_key: roleKey };
              if (!fe.validate(newUserSchema, payload)) return;
              start(async () => {
                const res = await createUser(payload);
                if (res.ok) {
                  toast.success(res.message);
                  setEmail(""); setFullName(""); setPassword("");
                  fe.clear();
                  router.refresh();
                } else if (!fe.fromResult(res)) toast.error(res.message);
              });
            }}
          >
            {pending ? "Creando…" : "Crear usuario"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <Image
                          src={u.avatar_url}
                          alt={u.full_name ?? "Usuario"}
                          width={36}
                          height={36}
                          unoptimized
                          className="size-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {initials(u.full_name || u.email)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <span className="font-medium">{u.full_name || "—"}</span>
                        {u.cargo && <span className="block text-xs text-muted-foreground">{u.cargo}</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="block text-xs text-muted-foreground">{u.email}</span>
                    {u.phone && <span className="block text-xs text-muted-foreground">{u.phone}</span>}
                  </TableCell>
                  <TableCell>
                    <Select
                      defaultValue={u.role_key ?? undefined}
                      onValueChange={(v) =>
                        start(async () => {
                          const res = await setUserRole(u.id, v);
                          if (res.ok) { toast.success(res.message); router.refresh(); }
                          else toast.error(res.message);
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-48 text-xs"><SelectValue placeholder="Sin rol" /></SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {u.is_active ? (
                      <Badge variant="success">Activo</Badge>
                    ) : (
                      <Badge variant="muted">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mr-1"
                      onClick={() => setEditando(u)}
                      aria-label={`Editar a ${u.full_name ?? u.email ?? "usuario"}`}
                    >
                      <Pencil className="size-3.5" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        start(async () => {
                          const res = await toggleUserActive(u.id, !u.is_active);
                          if (res.ok) { toast.success(res.message); router.refresh(); }
                          else toast.error(res.message);
                        })
                      }
                    >
                      {u.is_active ? <><X className="size-3.5" /> Desactivar</> : <><Check className="size-3.5" /> Activar</>}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Radix lo lleva al body: dónde se declare no afecta al layout. */}
      <UsuarioEditarDialog
        usuario={editando}
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
      />
    </div>
  );
}
