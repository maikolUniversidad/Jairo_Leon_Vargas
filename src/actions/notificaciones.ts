"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  dispatchExternalChannel,
  type Channel,
  type Recipient,
} from "@/lib/notifications/channels";
import { type ActionResult } from "./types";

export interface NotificationRow {
  id: string;
  titulo: string;
  cuerpo: string | null;
  tipo: string;
  url: string | null;
  leida: boolean;
  created_at: string;
}

/* ───────────── Bandeja personal ───────────── */

export async function getMyNotifications(limit = 15): Promise<NotificationRow[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id,titulo,cuerpo,tipo,url,leida,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data as NotificationRow[]) ?? [];
  } catch {
    return [];
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("leida", false);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function markAsRead(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ leida: true }).eq("id", id);
  if (error) return { ok: false, message: "No se pudo marcar." };
  revalidatePath("/dashboard");
  return { ok: true, message: "Marcada." };
}

export async function markAllRead(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };
  const { error } = await supabase
    .from("notifications")
    .update({ leida: true })
    .eq("user_id", user.id)
    .eq("leida", false);
  if (error) return { ok: false, message: "No se pudo actualizar." };
  revalidatePath("/dashboard");
  return { ok: true, message: "Todas marcadas como leídas." };
}

/* ───────────── Envío administrable (multicanal + auditable) ───────────── */

export interface SendInput {
  titulo: string;
  cuerpo?: string;
  tipo?: string;
  url?: string;
  canales: Channel[];
  audiencia_tipo: "todos" | "rol" | "usuario";
  audiencia_valor?: string; // rol o user_id
}

export async function sendNotification(
  input: SendInput,
): Promise<ActionResult<{ total: number; resultado: Record<string, string> }>> {
  if (!input.titulo?.trim()) return { ok: false, message: "El título es obligatorio." };
  const canales = input.canales?.length ? input.canales : (["in_app"] as Channel[]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesión no válida." };

  // 1) Resolver destinatarios (RLS exige rol emisor para leer profiles/roles)
  let recipients: Recipient[] = [];
  if (input.audiencia_tipo === "usuario" && input.audiencia_valor) {
    const { data } = await supabase
      .from("profiles")
      .select("id,email,phone")
      .eq("id", input.audiencia_valor);
    recipients = (data ?? []).map((p) => ({ user_id: p.id, email: p.email, phone: p.phone }));
  } else if (input.audiencia_tipo === "rol" && input.audiencia_valor) {
    const { data: rows } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", input.audiencia_valor);
    const ids = (rows ?? []).map((r) => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,email,phone")
        .in("id", ids);
      recipients = (profs ?? []).map((p) => ({ user_id: p.id, email: p.email, phone: p.phone }));
    }
  } else {
    const { data } = await supabase
      .from("profiles")
      .select("id,email,phone")
      .eq("is_active", true);
    recipients = (data ?? []).map((p) => ({ user_id: p.id, email: p.email, phone: p.phone }));
  }

  if (recipients.length === 0) {
    return { ok: false, message: "No hay destinatarios para ese criterio." };
  }

  const payload = {
    titulo: input.titulo.trim(),
    cuerpo: input.cuerpo?.trim() || null,
    url: input.url?.trim() || null,
    tipo: input.tipo || "info",
  };

  // 2) Despachar canales externos (best-effort, auditable)
  const resultado: Record<string, string> = {};
  for (const canal of canales) {
    if (canal === "in_app") {
      resultado.in_app = `enviados:${recipients.length}`;
      continue;
    }
    resultado[canal] = await dispatchExternalChannel(canal, recipients, payload);
  }

  // 3) Registrar el batch (auditoría) y obtener su id
  const { data: batch, error: batchErr } = await supabase
    .from("notification_batches")
    .insert({
      titulo: payload.titulo,
      cuerpo: payload.cuerpo,
      tipo: payload.tipo,
      url: payload.url,
      canales,
      audiencia_tipo: input.audiencia_tipo,
      audiencia_valor: input.audiencia_valor ?? null,
      total_destinatarios: recipients.length,
      resultado_canales: resultado,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (batchErr || !batch) {
    return { ok: false, message: "No se pudo registrar el envío (¿permisos?)." };
  }

  // 4) Crear las notificaciones in-app por destinatario
  if (canales.includes("in_app")) {
    const rows = recipients.map((r) => ({
      user_id: r.user_id,
      titulo: payload.titulo,
      cuerpo: payload.cuerpo,
      tipo: payload.tipo,
      url: payload.url,
      canal: "in_app",
      batch_id: batch.id,
      created_by: user.id,
    }));
    // Inserciones por lotes de 500 para no exceder límites
    for (let i = 0; i < rows.length; i += 500) {
      await supabase.from("notifications").insert(rows.slice(i, i + 500));
    }
  }

  revalidatePath("/dashboard/notificaciones");
  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `Notificación enviada a ${recipients.length} destinatario(s).`,
    data: { total: recipients.length, resultado },
  };
}
