/** Constantes y tipos de Drive compartidos entre servidor y cliente (sin server-only). */

export const DRIVE_TREE: { key: string; name: string }[] = [
  { key: "tareas", name: "01 Tareas" },
  { key: "contactos", name: "02 Contactos" },
  { key: "documentos", name: "03 Documentos" },
  { key: "comunicaciones", name: "04 Comunicaciones" },
  { key: "solicitudes", name: "05 Solicitudes" },
  { key: "territorio", name: "06 Territorio" },
  { key: "eventos", name: "07 Eventos" },
];

export interface DriveConfig {
  connected: boolean;
  email?: string;
  root_folder_id?: string;
  root_link?: string;
  folders?: Record<string, string>;
  connected_at?: string;
}
