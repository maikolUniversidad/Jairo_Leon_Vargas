import { PageHeader } from "@/components/dashboard/shared";
import { EquiposManager } from "@/components/dashboard/equipos-manager";
import { listEquiposConIntegrantes, listUsuariosPlataforma } from "@/actions/equipos";

/**
 * Gestión de equipos dentro de Comunicaciones.
 *
 * El catálogo ya existía en Configuración, pero esa sección solo la abren
 * `super_admin` y `administrador`. Como la subida de material exige elegir un
 * equipo, el rol `comunicaciones` quedaba sin poder subir nada: tenía el permiso
 * para crear equipos y ninguna pantalla desde donde hacerlo.
 */
export default async function EquiposPage() {
  const [equipos, usuarios] = await Promise.all([
    listEquiposConIntegrantes(),
    listUsuariosPlataforma(),
  ]);

  return (
    <>
      <PageHeader
        title="Equipos de cobertura"
        description="Quién graba y quién fotografía. El material que se sube se atribuye a un equipo."
      />
      <EquiposManager equipos={equipos} usuarios={usuarios} />
    </>
  );
}
