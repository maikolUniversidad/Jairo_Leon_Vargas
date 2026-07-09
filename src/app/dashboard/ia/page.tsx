import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AsistenteClient, type PersonaChat } from "@/components/dashboard/ia/AsistenteClient";
import type { IACarpeta, IAConversacion } from "@/types/database";

async function cargarPersonas(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PersonaChat[]> {
  const [{ data: ciud }, { data: cont }] = await Promise.all([
    supabase
      .from("citizens")
      .select("id, nombre, apellido, documento, tipo_documento")
      .is("deleted_at", null)
      .order("nombre", { ascending: true })
      .limit(600),
    supabase
      .from("contacts")
      .select("id, nombre, apellido, organizacion")
      .is("deleted_at", null)
      .order("nombre", { ascending: true })
      .limit(600),
  ]);

  const personas: PersonaChat[] = [];
  for (const c of ciud ?? []) {
    personas.push({
      id: c.id,
      tipo: "ciudadano",
      nombres: c.nombre ?? "",
      apellidos: c.apellido ?? "",
      documento: c.documento ?? "",
      tipo_doc: c.tipo_documento ?? "CC",
    });
  }
  for (const c of cont ?? []) {
    personas.push({
      id: c.id,
      tipo: "contacto",
      nombres: c.nombre ?? "",
      apellidos: c.apellido ?? "",
      documento: c.organizacion ?? "",
      tipo_doc: "Contacto",
    });
  }
  return personas;
}

export default async function IaPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const { prompt } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: carpetas }, { data: conversaciones }, personas] = await Promise.all([
    supabase.from("ia_carpetas").select("*").eq("user_id", user.id).order("orden", { ascending: true }),
    supabase
      .from("ia_conversaciones")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(300),
    cargarPersonas(supabase),
  ]);

  return (
    <div className="-m-4 h-[calc(100dvh-8rem)] overflow-hidden lg:-m-6 lg:h-[calc(100dvh-4rem)]">
      <AsistenteClient
        userId={user.id}
        carpetasIniciales={(carpetas as IACarpeta[]) ?? []}
        conversacionesIniciales={(conversaciones as IAConversacion[]) ?? []}
        personas={personas}
        promptInicial={prompt}
      />
    </div>
  );
}
