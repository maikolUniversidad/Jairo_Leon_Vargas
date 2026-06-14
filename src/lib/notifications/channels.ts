import "server-only";

/**
 * Adaptadores de canales de notificación. El canal `in_app` se persiste en la
 * tabla `notifications` (lo hace la server action). Los canales externos
 * (email/push/whatsapp) se despachan aquí; hoy email usa Resend si hay clave,
 * y push/whatsapp quedan como stubs listos para conectar (FCM / WhatsApp Cloud).
 */
export type Channel = "in_app" | "email" | "push" | "whatsapp";

export const CHANNELS: { value: Channel; label: string }[] = [
  { value: "in_app", label: "En la plataforma" },
  { value: "email", label: "Correo electrónico" },
  { value: "push", label: "Push (web/móvil)" },
  { value: "whatsapp", label: "WhatsApp" },
];

export interface Recipient {
  user_id: string;
  email?: string | null;
  phone?: string | null;
}

export interface NotificationPayload {
  titulo: string;
  cuerpo?: string | null;
  url?: string | null;
  tipo?: string;
}

/** ¿Está configurado el canal (hay credenciales)? */
export function channelConfigured(channel: Channel): boolean {
  switch (channel) {
    case "in_app":
      return true;
    case "email":
      return Boolean(process.env.RESEND_API_KEY);
    case "push":
      return Boolean(process.env.FCM_SERVER_KEY);
    case "whatsapp":
      return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
    default:
      return false;
  }
}

/**
 * Despacha un canal externo. Devuelve un resumen auditable.
 * No lanza: ante error o falta de config devuelve un estado descriptivo.
 */
export async function dispatchExternalChannel(
  channel: Exclude<Channel, "in_app">,
  recipients: Recipient[],
  payload: NotificationPayload,
): Promise<string> {
  if (!channelConfigured(channel)) return "no_configurado";

  try {
    if (channel === "email") return await sendEmails(recipients, payload);
    if (channel === "push") return "pendiente_integracion_fcm";
    if (channel === "whatsapp") return "pendiente_integracion_whatsapp";
    return "no_soportado";
  } catch (e) {
    return `error: ${(e as Error).message.slice(0, 80)}`;
  }
}

async function sendEmails(
  recipients: Recipient[],
  payload: NotificationPayload,
): Promise<string> {
  const key = process.env.RESEND_API_KEY!;
  const from = process.env.RESEND_FROM || "UTL 360 <onboarding@resend.dev>";
  const targets = recipients.map((r) => r.email).filter((e): e is string => Boolean(e));
  if (targets.length === 0) return "sin_correos";

  let ok = 0;
  // Envío individual best-effort (Resend acepta un array en "to" por mensaje).
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: targets,
      subject: payload.titulo,
      html: `<h2>${payload.titulo}</h2><p>${payload.cuerpo ?? ""}</p>${
        payload.url ? `<p><a href="${payload.url}">Ver más</a></p>` : ""
      }`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.ok) ok = targets.length;
  return `enviados:${ok}/${targets.length}`;
}
