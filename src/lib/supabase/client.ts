import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para Componentes de Cliente ("use client").
 * Usa la ANON KEY y respeta RLS. Seguro para el navegador.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
