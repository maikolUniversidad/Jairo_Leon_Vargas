import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

// Endpoint que dispara las notificaciones de vencimiento de tareas.
// Lo invoca Vercel Cron a diario (ver vercel.json). Vercel agrega
// automáticamente el header "Authorization: Bearer <CRON_SECRET>" cuando
// CRON_SECRET está configurada en el proyecto. También se puede llamar a mano
// con ?secret=<CRON_SECRET> para pruebas.
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Sin secreto configurado: solo se permite en desarrollo (nunca en producción).
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization");
  const fromQuery = new URL(req.url).searchParams.get("secret");
  return header === `Bearer ${secret}` || fromQuery === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("notify_due_tasks");
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, notificaciones: data ?? 0 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
