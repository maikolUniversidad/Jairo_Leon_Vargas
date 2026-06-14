import { createClient } from "@supabase/supabase-js";

import "server-only";

/**
 * Cliente Supabase con SERVICE ROLE. BYPASSA RLS.
 *
 * ⚠️  USAR SOLO EN EL SERVIDOR y solo en operaciones que lo requieran
 * (p. ej. crear el primer perfil/rol, tareas administrativas). El import
 * `server-only` provoca un error de build si este módulo se importa en el cliente.
 *
 * NUNCA exponer SUPABASE_SERVICE_ROLE_KEY con prefijo NEXT_PUBLIC_.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no está configurada. Requerida para el cliente admin.",
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
