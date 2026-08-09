import { describe, expect, it } from "vitest";

import {
  BUCKETS_ESPERADOS,
  MODULOS_ESPERADOS,
  MODULOS_SIEMPRE_VISIBLES,
  ROLES_ESPERADOS,
  TABLAS_NUCLEO,
  TABLAS_SOLO_SERVICE_ROLE,
  TRIGGERS_CRITICOS,
} from "../../scripts/qa-contract.mjs";
import { ALL_MODULES, ROLES } from "@/types/roles";

// El QA de base de datos (npm run qa:db) compara Postgres contra el contrato de
// scripts/qa-contract.mjs. Si alguien toca src/types/roles.ts y no actualiza el
// contrato, el QA validaría contra una expectativa vieja y daría verde en falso.
// Estas pruebas son las que impiden esa desincronización.

describe("contrato QA ↔ src/types/roles.ts", () => {
  it("los roles esperados por el QA son exactamente los del código", () => {
    expect([...(ROLES_ESPERADOS as string[])].sort()).toEqual([...ROLES].sort());
  });

  it("los módulos del QA + los siempre visibles cubren todos los del código", () => {
    const cubiertos = [
      ...(MODULOS_ESPERADOS as string[]),
      ...(MODULOS_SIEMPRE_VISIBLES as string[]),
    ].sort();
    expect(cubiertos).toEqual([...ALL_MODULES].sort());
  });

  it("ningún módulo aparece a la vez como validado y como siempre visible", () => {
    const solapan = (MODULOS_ESPERADOS as string[]).filter((m) =>
      (MODULOS_SIEMPRE_VISIBLES as string[]).includes(m),
    );
    expect(solapan).toEqual([]);
  });

  it("`perfil` y `ubicaciones` siguen siendo los únicos concedidos sin permisos", () => {
    // src/lib/auth.ts los añade a mano a viewableModules. Si se agrega otro allá,
    // hay que reflejarlo aquí o el QA exigirá permisos que la app no consulta.
    expect([...(MODULOS_SIEMPRE_VISIBLES as string[])].sort()).toEqual(["perfil", "ubicaciones"]);
  });
});

describe("contrato QA · integridad interna", () => {
  it("no hay roles ni módulos repetidos", () => {
    expect(new Set(ROLES_ESPERADOS as string[]).size).toBe((ROLES_ESPERADOS as string[]).length);
    expect(new Set(MODULOS_ESPERADOS as string[]).size).toBe((MODULOS_ESPERADOS as string[]).length);
  });

  it("los buckets privados están declarados explícitamente", () => {
    const privados = Object.entries(BUCKETS_ESPERADOS as Record<string, { publico: boolean }>)
      .filter(([, v]) => !v.publico)
      .map(([k]) => k)
      .sort();
    // `documentos` y `conocimiento` guardan material reservado: la app los sirve
    // con URL firmada desde el servidor. Si alguno se vuelve público, el QA falla.
    expect(privados).toEqual(["conocimiento", "documentos"]);
  });

  it("cada bucket declara su visibilidad", () => {
    for (const [nombre, cfg] of Object.entries(BUCKETS_ESPERADOS as Record<string, { publico: boolean }>)) {
      expect(typeof cfg.publico, `${nombre} sin visibilidad`).toBe("boolean");
    }
  });

  it("las tablas de solo service role no están entre las tablas núcleo", () => {
    // Las núcleo se leen desde la app con la sesión del usuario; las de service
    // role, no. Que una esté en ambas listas sería una contradicción.
    const solapan = (TABLAS_SOLO_SERVICE_ROLE as string[]).filter((t) =>
      (TABLAS_NUCLEO as string[]).includes(t),
    );
    expect(solapan).toEqual([]);
  });

  it("cada trigger crítico declara tabla, nombre y esquema", () => {
    for (const t of TRIGGERS_CRITICOS as [string, string, string][]) {
      expect(t).toHaveLength(3);
      expect(t.every((x) => typeof x === "string" && x.length > 0)).toBe(true);
      expect(["public", "auth", "storage"]).toContain(t[2]);
    }
  });
});
