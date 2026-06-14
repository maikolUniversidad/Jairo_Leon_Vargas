import { Users } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/dashboard/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Citizen } from "@/types/database";

async function getCitizens(): Promise<Citizen[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("citizens")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data as Citizen[]) ?? [];
  } catch {
    return [];
  }
}

export default async function CiudadanosPage() {
  const citizens = await getCitizens();

  return (
    <>
      <PageHeader
        title="CRM ciudadano"
        description="Personas registradas desde la landing y por el equipo."
      />

      {citizens.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin ciudadanos registrados"
          description="Cuando alguien se registre desde la landing o el equipo cargue contactos, aparecerán aquí."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Localidad</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Registrado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {citizens.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.nombre} {c.apellido ?? ""}
                    </TableCell>
                    <TableCell>
                      {c.localidad ?? "—"}
                      {c.barrio ? <span className="text-muted-foreground"> · {c.barrio}</span> : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.whatsapp || c.telefono || c.email || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{c.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(c.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
