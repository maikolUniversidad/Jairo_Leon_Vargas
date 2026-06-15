"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { UserPlus, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
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
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState(roles[0]?.key ?? "");

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <UserPlus className="size-4" /> Crear usuario
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="u-name">Nombre</Label>
              <Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="u-email">Correo *</Label>
              <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="u-pass">Contraseña *</Label>
              <Input id="u-pass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mín. 6" />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={roleKey} onValueChange={setRoleKey}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="mt-4"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await createUser({ email, password, full_name: fullName, role_key: roleKey });
                if (res.ok) {
                  toast.success(res.message);
                  setEmail(""); setFullName(""); setPassword("");
                  router.refresh();
                } else toast.error(res.message);
              })
            }
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
    </div>
  );
}
