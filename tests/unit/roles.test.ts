import { describe, expect, it } from "vitest";

import {
  ADMIN_ROLES,
  ALL_MODULES,
  MODULE_ACCESS,
  MODULE_LABELS,
  ROLES,
  ROLE_LABELS,
  canAccessModule,
  type AppRole,
  type DashboardModule,
} from "@/types/roles";

// La matriz de roles es el contrato que comparten la navegación del dashboard,
// las políticas RLS de Postgres y el QA de base de datos. Si se desincroniza,
// alguien pierde acceso o lo gana de más.

describe("catálogo de roles", () => {
  it("no tiene roles repetidos", () => {
    expect(new Set(ROLES).size).toBe(ROLES.length);
  });

  it("tiene etiqueta legible para cada rol", () => {
    for (const rol of ROLES) {
      expect(ROLE_LABELS[rol], `falta etiqueta de ${rol}`).toBeTruthy();
    }
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...ROLES].sort());
  });

  it("los roles administrativos existen en el catálogo", () => {
    for (const rol of ADMIN_ROLES) expect(ROLES).toContain(rol);
  });
});

describe("catálogo de módulos", () => {
  it("tiene etiqueta legible para cada módulo", () => {
    expect(Object.keys(MODULE_LABELS).sort()).toEqual([...ALL_MODULES].sort());
  });

  it("ALL_MODULES refleja exactamente las llaves de MODULE_ACCESS", () => {
    expect(ALL_MODULES.sort()).toEqual(Object.keys(MODULE_ACCESS).sort());
  });

  it("toda lista de acceso contiene solo roles válidos", () => {
    for (const [modulo, permitidos] of Object.entries(MODULE_ACCESS)) {
      if (permitidos === "*") continue;
      for (const rol of permitidos) {
        expect(ROLES, `${modulo} referencia el rol inexistente ${rol}`).toContain(rol);
      }
    }
  });

  it("ningún módulo queda sin nadie que pueda entrar", () => {
    for (const [modulo, permitidos] of Object.entries(MODULE_ACCESS)) {
      if (permitidos === "*") continue;
      expect(permitidos.length, `${modulo} no lo puede ver nadie`).toBeGreaterThan(0);
    }
  });
});

describe("canAccessModule", () => {
  it("los administradores entran a todos los módulos", () => {
    for (const rol of ADMIN_ROLES) {
      for (const modulo of ALL_MODULES) {
        expect(canAccessModule(rol, modulo), `${rol} no entra a ${modulo}`).toBe(true);
      }
    }
  });

  it("los módulos abiertos (`*`) los ve cualquier rol", () => {
    const abiertos = (Object.entries(MODULE_ACCESS) as [DashboardModule, AppRole[] | "*"][])
      .filter(([, v]) => v === "*")
      .map(([k]) => k);
    expect(abiertos.length).toBeGreaterThan(0);
    for (const modulo of abiertos) {
      for (const rol of ROLES) expect(canAccessModule(rol, modulo)).toBe(true);
    }
  });

  it("solo los administradores entran a Configuración", () => {
    const admitidos = ROLES.filter((r) => canAccessModule(r, "configuracion"));
    expect(admitidos.sort()).toEqual([...ADMIN_ROLES].sort());
  });

  it("un rol de solo lectura no entra a los módulos restringidos", () => {
    expect(canAccessModule("consulta", "ciudadanos")).toBe(false);
    expect(canAccessModule("consulta", "auditoria")).toBe(false);
    expect(canAccessModule("consulta", "configuracion")).toBe(false);
    expect(canAccessModule("voluntario", "reportes")).toBe(false);
  });

  it("sin rol no se entra a ningún lado, ni a los módulos abiertos", () => {
    for (const modulo of ALL_MODULES) {
      expect(canAccessModule(null, modulo)).toBe(false);
      expect(canAccessModule(undefined, modulo)).toBe(false);
    }
  });

  it("comunicaciones ve su módulo pero no el de ciudadanos", () => {
    expect(canAccessModule("comunicaciones", "comunicaciones")).toBe(true);
    expect(canAccessModule("comunicaciones", "ciudadanos")).toBe(false);
  });
});
