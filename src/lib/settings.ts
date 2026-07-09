import { createClient } from "@/lib/supabase/server";

export interface PerfilPublico {
  nombre: string;
  cargo_aspiracion: string;
  movimiento: string;
  renglon: string;
  lema: string;
  subtitulo: string;
  biografia_corta: string;
  foto_url: string;
  /** Video de fondo (difuminado) para el intro. Vacío → fondo ambiente animado. */
  hero_video_url: string;
  redes: {
    facebook?: string;
    instagram?: string;
    x?: string;
    tiktok?: string;
    youtube?: string;
  };
}

/** Valores por defecto (datos públicos verificados). NO inventar biografía. */
export const PERFIL_DEFAULT: PerfilPublico = {
  nombre: "Jairo León Vargas",
  cargo_aspiracion: "Candidato a Cámara por Bogotá D.C.",
  movimiento: "Pacto Histórico / Colombia Humana",
  renglon: "106",
  lema: "Una voz desde el territorio para construir con la gente",
  subtitulo:
    "Gestión social, participación ciudadana y trabajo comunitario para Bogotá y Colombia.",
  biografia_corta:
    "Trayectoria pública con experiencia territorial y social en Bogotá y en programas de articulación de oferta social.",
  foto_url: "",
  hero_video_url: "",
  redes: {},
};

/**
 * Lee el perfil público desde `settings`. Si Supabase no está configurado
 * o no hay fila, devuelve los valores por defecto (la landing nunca falla).
 */
export async function getPerfilPublico(): Promise<PerfilPublico> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "perfil_publico")
      .maybeSingle();

    if (data?.value) {
      return { ...PERFIL_DEFAULT, ...(data.value as Partial<PerfilPublico>) };
    }
  } catch {
    // Supabase aún no configurado: usar defaults.
  }
  return PERFIL_DEFAULT;
}
