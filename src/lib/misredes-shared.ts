// Tipo y valores por defecto de la página /misredes.
// En un módulo neutral (no "use server") para poder exportar el objeto y el tipo.

export interface MisredesConfig {
  nombre: string;
  cargo: string;
  periodo: string;
  bio: string;
  eyebrow: string;
  trayectoria: string[];
  fotoUrl: string;
  fotoDestacada: string;
  campana: { activa: boolean; numero: string; fechaEleccion: string };
  whatsapp: string;
  redes: { instagram: string; tiktok: string; youtube: string; x: string; threads: string; facebook: string };
  destacadas: { cover: string; label: string; url: string }[];
  enlaces: { emoji: string; titulo: string; sub: string; url: string }[];
  prensa: {
    mostrar: boolean;
    comunicados: string;
    fotografias: string;
    kit: string;
    contactoNombre: string;
    contactoNumero: string;
  };
  focus: { emoji: string; titulo: string; texto: string; color: string }[];
  ubicacion: string;
  colores: Record<string, string>;
}

/** Valores por defecto (espejo de los DEFAULTS de la página /misredes). */
export const MISREDES_DEFAULTS: MisredesConfig = {
  nombre: "Jairo León Vargas",
  cargo: "Representante a la Cámara por Bogotá",
  periodo: "2026–2030",
  bio: "Defendiendo la dignidad en Bogotá.",
  eyebrow: "Cámara de Representantes · Bogotá",
  trayectoria: ["Exalcalde de San Cristóbal", "Ex-DPS", "Ex-MinSalud"],
  fotoUrl: "",
  fotoDestacada: "",
  campana: { activa: false, numero: "00", fechaEleccion: "" },
  whatsapp: "57XXXXXXXXXX",
  redes: {
    instagram: "https://instagram.com/jairo_leon_vargas",
    tiktok: "https://www.tiktok.com/@jairo.leon.vargas",
    youtube: "",
    x: "",
    threads: "",
    facebook: "",
  },
  destacadas: [
    { cover: "J", label: "Historia", url: "https://instagram.com/jairo_leon_vargas" },
    { cover: "A", label: "Salud", url: "https://instagram.com/jairo_leon_vargas" },
    { cover: "I", label: "Agenda", url: "https://instagram.com/jairo_leon_vargas" },
    { cover: "R", label: "Comunidad", url: "https://instagram.com/jairo_leon_vargas" },
    { cover: "O", label: "Bogotá", url: "https://instagram.com/jairo_leon_vargas" },
  ],
  enlaces: [
    { emoji: "📅", titulo: "Agenda ciudadana", sub: "Dónde estaré esta semana", url: "https://instagram.com/jairo_leon_vargas" },
    { emoji: "🤝", titulo: "Súmate al equipo", sub: "Sé parte del cambio", url: "https://instagram.com/jairo_leon_vargas" },
    { emoji: "📰", titulo: "Rendición de cuentas", sub: "Mi gestión, a la vista", url: "https://instagram.com/jairo_leon_vargas" },
  ],
  prensa: {
    mostrar: true,
    comunicados: "https://instagram.com/jairo_leon_vargas",
    fotografias: "https://instagram.com/jairo_leon_vargas",
    kit: "https://instagram.com/jairo_leon_vargas",
    contactoNombre: "",
    contactoNumero: "",
  },
  focus: [
    { emoji: "🏥", titulo: "Salud", texto: "Salud digna y cercana: un derecho, no un privilegio.", color: "var(--c4)" },
    { emoji: "🗣", titulo: "Escuchar a la gente", texto: "Gobernar oyendo a los barrios. La ciudadanía al centro.", color: "var(--c2)" },
    { emoji: "🐾", titulo: "Bienestar animal", texto: "Una Bogotá que también cuida y protege a los animales.", color: "var(--c1)" },
    { emoji: "💼", titulo: "Empleo", texto: "Trabajo digno y oportunidades reales para las familias.", color: "var(--c3)" },
  ],
  ubicacion: "Bogotá D.C., Colombia",
  colores: {},
};
