import { looksLikeEmail, phoneDigits } from "@/lib/validations";

/** Indicativo por defecto (Colombia) para números escritos sin país. */
const PAIS_POR_DEFECTO = "57";

/**
 * Normaliza un teléfono a formato internacional para wa.me.
 *
 * Acepta lo que la gente escribe de verdad: "300 123 4567", "(601) 555-0000",
 * "+57 300 1234567". Devuelve null si no queda un número marcable.
 */
export function whatsappNumero(raw: string | null | undefined): string | null {
  const original = (raw ?? "").trim();
  if (!original) return null;

  const d = phoneDigits(original);
  if (d.length < 7) return null; // demasiado corto para ser un número real

  // Si venía con "+", los dígitos ya incluyen el indicativo de país.
  if (original.startsWith("+")) return d;

  // Ya trae 57 delante de un número nacional de 10 dígitos: se deja igual.
  if (d.length === 12 && d.startsWith(PAIS_POR_DEFECTO)) return d;

  // En Colombia todo número nacional tiene 10 dígitos: celular (3xx) o fijo
  // (60x). Sin el indicativo de país, wa.me leería "60" como Malasia.
  if (d.length === 10) return PAIS_POR_DEFECTO + d;

  // Fijo escrito sin indicativo de ciudad (7 u 8 dígitos): no se puede
  // reconstruir a qué ciudad pertenece, así que no se ofrece el botón.
  if (d.length < 10) return null;

  // Cualquier otra longitud se asume ya internacional.
  return d;
}

/** Enlace a WhatsApp, o null si el número no sirve. */
export function whatsappUrl(raw: string | null | undefined, mensaje?: string): string | null {
  const n = whatsappNumero(raw);
  if (!n) return null;
  const q = mensaje ? `?text=${encodeURIComponent(mensaje)}` : "";
  return `https://wa.me/${n}${q}`;
}

/** Enlace `tel:`, o null si no hay número marcable. */
export function telUrl(raw: string | null | undefined): string | null {
  const d = phoneDigits(raw);
  if (d.length < 7) return null;
  return `tel:${(raw ?? "").trim().startsWith("+") ? "+" : ""}${d}`;
}

/** Enlace `mailto:`, o null si el correo no es usable. */
export function mailtoUrl(
  raw: string | null | undefined,
  opts?: { asunto?: string; cuerpo?: string },
): string | null {
  const v = (raw ?? "").trim();
  if (!v || !looksLikeEmail(v)) return null;
  const params = new URLSearchParams();
  if (opts?.asunto) params.set("subject", opts.asunto);
  if (opts?.cuerpo) params.set("body", opts.cuerpo);
  const q = params.toString();
  return `mailto:${v}${q ? `?${q}` : ""}`;
}

/**
 * Convierte un usuario o URL de red social en enlace navegable.
 * Acepta "@jairo", "jairo" o "https://instagram.com/jairo".
 */
export function redSocialUrl(
  red: "facebook" | "instagram" | "x_twitter" | "tiktok",
  raw: string | null | undefined,
): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;

  const user = v.replace(/^@/, "");
  if (!user) return null;
  const base: Record<typeof red, string> = {
    facebook: "https://facebook.com/",
    instagram: "https://instagram.com/",
    x_twitter: "https://x.com/",
    tiktok: "https://tiktok.com/@",
  };
  return base[red] + user;
}

/** Normaliza un sitio web escrito sin protocolo. */
export function sitioWebUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
