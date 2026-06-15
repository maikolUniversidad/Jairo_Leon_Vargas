"use server";

import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { type ActionResult } from "./types";

export interface CalendarSubscription {
  icsUrl: string;
  webcalUrl: string;
}

function buildUrls(token: string): CalendarSubscription {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const icsUrl = `${base}/api/calendar/${token}`;
  const webcalUrl = icsUrl.replace(/^https?:/, "webcal:");
  return { icsUrl, webcalUrl };
}

async function ensureToken(regenerate = false): Promise<CalendarSubscription | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  if (!regenerate) {
    const { data } = await supabase
      .from("profiles")
      .select("calendar_token")
      .eq("id", user.id)
      .maybeSingle();
    if (data?.calendar_token) return buildUrls(data.calendar_token);
  }

  const token = (randomUUID() + randomUUID()).replace(/-/g, "");
  const { error } = await supabase
    .from("profiles")
    .update({ calendar_token: token })
    .eq("id", user.id);
  if (error) return null;
  return buildUrls(token);
}

/** Obtiene (o crea) la suscripción de calendario del usuario. */
export async function getCalendarSubscription(): Promise<CalendarSubscription | null> {
  return ensureToken(false);
}

/** Regenera el token (invalida el enlace anterior). */
export async function regenerateCalendarToken(): Promise<ActionResult<CalendarSubscription>> {
  const sub = await ensureToken(true);
  if (!sub) return { ok: false, message: "No se pudo regenerar." };
  return { ok: true, message: "Enlace regenerado. El anterior dejó de funcionar.", data: sub };
}
