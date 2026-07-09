"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";

const TABS = ["usuarios", "roles", "integraciones", "conocimiento", "misredes"] as const;

/**
 * Tabs de Configuración controlados por el query param `?tab=`, para que los
 * submódulos (móvil y escritorio) cambien de pestaña. Los paneles se pasan como
 * children (cada uno es un <TabsContent value="…">), renderizados en el server
 * component de la página con sus datos ya cargados.
 */
export function ConfiguracionTabs({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useTabParam("tab", TABS[0], TABS);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number])}>
      {/* En móvil la navegación de submódulos vive en la barra inferior (MobileNav);
          aquí se oculta para no duplicarla. */}
      <TabsList className="hidden lg:inline-flex">
        <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        <TabsTrigger value="roles">Roles y permisos</TabsTrigger>
        <TabsTrigger value="integraciones">Integraciones</TabsTrigger>
        <TabsTrigger value="conocimiento">Base de conocimiento</TabsTrigger>
        <TabsTrigger value="misredes">Página /misredes</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  );
}
