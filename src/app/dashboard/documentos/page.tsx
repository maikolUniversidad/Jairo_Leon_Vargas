import { PageHeader } from "@/components/dashboard/shared";
import { DocumentsExplorer } from "@/components/dashboard/documents-explorer";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import type { DocumentFolder, DocumentRecord, Profile } from "@/types/database";
import type { AppRole } from "@/types/roles";

const MANAGER_ROLES: AppRole[] = [
  "super_admin",
  "administrador",
  "direccion_general",
  "coordinador_utl",
  "juridico_legislativo",
  "comunicaciones",
];

export default async function DocumentosPage() {
  const [user, supabase] = await Promise.all([getSessionUser(), createClient()]);

  const [{ data: folders }, { data: documents }, { data: profiles }] = await Promise.all([
    supabase
      .from("document_folders")
      .select("*")
      .is("deleted_at", null)
      .order("nombre"),
    supabase
      .from("documents")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").limit(1000),
  ]);

  const canManage =
    !!user && (user.isAdmin || user.roles.some((r) => MANAGER_ROLES.includes(r)));

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Actas, informes, derechos de petición, respuestas y soportes, organizados por carpetas con acceso según el rol."
      />
      <DocumentsExplorer
        folders={(folders as DocumentFolder[]) ?? []}
        documents={(documents as DocumentRecord[]) ?? []}
        profiles={(profiles as Pick<Profile, "id" | "full_name" | "email">[]) ?? []}
        canManage={canManage}
        currentUserId={user?.id ?? null}
      />
    </>
  );
}
