import { Users, Inbox, MapPinned, Megaphone, type LucideIcon } from "lucide-react";

export interface CategoriaPreguntas {
  id: string;
  titulo: string;
  icon: LucideIcon;
  color: string; // clases de borde/color del ícono
  preguntas: string[];
}

/** Preguntas sugeridas del asistente, orientadas a la operación de UTL 360. */
export const PREGUNTAS_SUGERIDAS: CategoriaPreguntas[] = [
  {
    id: "ciudadanos",
    titulo: "Ciudadanos",
    icon: Users,
    color: "border-primary/30 text-primary",
    preguntas: [
      "Redáctame un mensaje de bienvenida para un ciudadano recién registrado.",
      "¿Qué datos debería pedirle a un ciudadano para abrir un caso de salud?",
      "Resume en 3 puntos cómo hacer seguimiento a un ciudadano de una localidad.",
    ],
  },
  {
    id: "solicitudes",
    titulo: "Solicitudes",
    icon: Inbox,
    color: "border-amber-300 text-amber-600",
    preguntas: [
      "Clasifica esta solicitud y sugiere prioridad y responsable.",
      "Redacta una respuesta formal para una petición ciudadana.",
      "¿Cómo priorizo un caso de salud urgente frente a una petición general?",
    ],
  },
  {
    id: "territorio",
    titulo: "Territorio",
    icon: MapPinned,
    color: "border-sky-300 text-sky-600",
    preguntas: [
      "Hazme un brief de una jornada territorial en una localidad de Bogotá.",
      "Propón 3 acciones de corto plazo para un barrio con problemas de movilidad.",
      "Convierte estas notas de una reunión en un acta con compromisos.",
    ],
  },
  {
    id: "comunicaciones",
    titulo: "Comunicaciones",
    icon: Megaphone,
    color: "border-fuchsia-300 text-fuchsia-600",
    preguntas: [
      "Dame 3 ideas de video corto sobre seguridad para redes.",
      "Escribe un guión de 45 segundos para un reel sobre una propuesta.",
      "Genera 5 títulos y 10 hashtags para una publicación en TikTok.",
    ],
  },
];
