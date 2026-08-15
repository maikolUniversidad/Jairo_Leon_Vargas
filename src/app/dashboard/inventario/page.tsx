import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/shared";
import { InventarioManager } from "@/components/dashboard/inventario/inventario-manager";
import {
  getInventarioStats,
  listEquiposResumen,
  listNovedades,
  listPrestamos,
  listUsuariosInventario,
} from "@/actions/inventario";

/**
 * Inventario de equipos físicos (cámaras, lentes, micrófonos…): catálogo con
 * piezas y partes, préstamos con video de entrega/recepción e historial, y
 * novedades (accidentes, daños, mantenimiento).
 *
 * Lo ve todo el staff (para solicitar préstamos); la gestión —registrar equipos,
 * entregar, recibir— la limita la RLS a `can_manage_inventario()`.
 */
export default async function InventarioPage() {
  const user = await requireUser();
  const canManage =
    user.isAdmin ||
    user.roles.some((r) => ["direccion_general", "coordinador_utl", "comunicaciones"].includes(r));

  const [equipos, prestamos, novedades, usuarios, stats] = await Promise.all([
    listEquiposResumen(),
    listPrestamos(),
    listNovedades(),
    listUsuariosInventario(),
    getInventarioStats(),
  ]);

  return (
    <>
      <PageHeader
        title="Inventario de equipos"
        description="Cámaras, lentes, micrófonos y demás: estado, piezas, préstamos con video de entrega y recepción, y novedades."
      />
      <InventarioManager
        equipos={equipos}
        prestamos={prestamos}
        novedades={novedades}
        usuarios={usuarios}
        stats={stats}
        canManage={canManage}
      />
    </>
  );
}
