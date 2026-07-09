import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { runCollectionFor, isDue } from "@/lib/monitoring/run";

// Revisa cada hora qué personas con programación automática están "vencidas" y
// ejecuta su recolección desde todas las APIs conectadas. Lo dispara Vercel Cron
// (ver vercel.json), autenticado con CRON_SECRET.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
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
    const admin = createAdminClient();
    const { data: persons, error } = await admin
      .from("monitor_persons")
      .select("id, nombre, alias, keywords, handles, auto_frecuencia, auto_hora, ultima_recoleccion")
      .is("deleted_at", null)
      .eq("auto_activo", true);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const now = new Date();
    const horaCO = (now.getUTCHours() + 24 - 5) % 24; // Colombia = UTC-5

    const procesadas: { persona: string; nuevas: number }[] = [];
    for (const p of (persons ?? []) as {
      id: string; nombre: string; alias: string[] | null; keywords: string[] | null;
      handles: Record<string, string> | null; auto_frecuencia: string; auto_hora: number;
      ultima_recoleccion: string | null;
    }[]) {
      if (!isDue(p, horaCO, now)) continue;
      const res = await runCollectionFor(admin, p, null);
      procesadas.push({ persona: p.nombre, nuevas: res.inserted });
    }

    return NextResponse.json({ ok: true, revisadas: persons?.length ?? 0, procesadas });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
