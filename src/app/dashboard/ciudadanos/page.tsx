import { Users } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/dashboard/shared";
import { CiudadanosList } from "@/components/dashboard/ciudadanos-list";
import { createClient } from "@/lib/supabase/server";
import type { Citizen } from "@/types/database";

async function getData(): Promise<{ citizens: Citizen[]; referrerById: Record<string, string> }> {
  try {
    const supabase = await createClient();
    const { data: citizens } = await supabase
      .from("citizens")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    const list = (citizens as Citizen[]) ?? [];
    const refIds = Array.from(
      new Set(list.map((c) => c.referido_por_contact_id).filter((x): x is string => Boolean(x))),
    );
    const referrerById: Record<string, string> = {};
    if (refIds.length > 0) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, nombre, apellido")
        .in("id", refIds);
      for (const c of contacts ?? [])
        referrerById[c.id] = `${c.nombre} ${c.apellido ?? ""}`.trim();
    }
    return { citizens: list, referrerById };
  } catch {
    return { citizens: [], referrerById: {} };
  }
}

export default async function CiudadanosPage() {
  const { citizens, referrerById } = await getData();

  return (
    <>
      <PageHeader
        title="CRM ciudadano"
        description="Personas registradas desde la landing y por el equipo. Cambia entre tabla y vCard."
      />
      {citizens.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin ciudadanos registrados"
          description="Cuando alguien se registre desde la landing o el equipo cargue contactos, aparecerán aquí."
        />
      ) : (
        <CiudadanosList citizens={citizens} referrerById={referrerById} />
      )}
    </>
  );
}
