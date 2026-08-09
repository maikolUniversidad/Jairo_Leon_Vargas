import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DIR = join(__dirname, "..", "..", "supabase", "migrations");

const archivos = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql") && !f.startsWith("_"))
  .sort();

/**
 * Números que ya quedaron repetidos en el historial y se aplicaron así.
 * No se tocan (renombrarlos rompería el orden ya ejecutado en producción),
 * pero cualquier repetición NUEVA sí debe fallar: dos migraciones con el mismo
 * número se aplican en un orden que depende del nombre, no de la intención.
 */
const DUPLICADOS_HISTORICOS = ["0012", "0013", "0018", "0023", "0024", "0025"];

describe("migraciones", () => {
  it("hay migraciones que revisar", () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  it("todas siguen el formato NNNN_nombre.sql", () => {
    const malas = archivos.filter((f) => !/^\d{4}_[a-z0-9_]+\.sql$/.test(f));
    expect(malas, `nombres fuera de formato: ${malas.join(", ")}`).toEqual([]);
  });

  it("no se introducen números duplicados nuevos", () => {
    const conteo = new Map<string, string[]>();
    for (const f of archivos) {
      const n = f.slice(0, 4);
      conteo.set(n, [...(conteo.get(n) ?? []), f]);
    }
    const duplicados = [...conteo.entries()].filter(([, fs]) => fs.length > 1);
    const nuevos = duplicados.filter(([n]) => !DUPLICADOS_HISTORICOS.includes(n));
    expect(
      nuevos.map(([n, fs]) => `${n}: ${fs.join(" y ")}`),
      "dos migraciones con el mismo número se aplican en orden alfabético, no en el que pensaste",
    ).toEqual([]);
  });

  it("ninguna migración está vacía", () => {
    const vacias = archivos.filter((f) => readFileSync(join(DIR, f), "utf8").trim().length < 20);
    expect(vacias, `sin contenido: ${vacias.join(", ")}`).toEqual([]);
  });

  it("todas llevan cabecera de comentario explicando qué hacen", () => {
    const sinCabecera = archivos.filter(
      (f) => !readFileSync(join(DIR, f), "utf8").trimStart().startsWith("--"),
    );
    expect(sinCabecera, `sin cabecera: ${sinCabecera.join(", ")}`).toEqual([]);
  });

  it("ninguna tabla de `public` se queda sin RLS en todo el historial", () => {
    // El agujero de task_due_pings fue exactamente esto: un `create table` cuyo
    // `enable row level security` nunca llegó, y la tabla quedó abierta a la
    // Data API. Se revisa el historial completo porque el proyecto activa RLS de
    // dos formas: con un ALTER directo, o con un bucle `foreach` sobre una lista
    // de nombres (0003_rls.sql, 0010_contactos.sql).
    const creadas = new Map<string, string>(); // tabla → archivo que la creó
    const conRls = new Set<string>();

    for (const f of archivos) {
      const sql = readFileSync(join(DIR, f), "utf8").toLowerCase();

      for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)/g)) {
        if (!creadas.has(m[1]!)) creadas.set(m[1]!, f);
      }
      for (const m of sql.matchAll(/alter table\s+(?:public\.)?(\w+)\s+enable row level security/g)) {
        conRls.add(m[1]!);
      }
      // Bloques `do $$ … $$;` que activan RLS recorriendo una lista de nombres.
      for (const bloque of sql.matchAll(/do \$\$([\s\S]*?)\$\$\s*;/g)) {
        const cuerpo = bloque[1] ?? "";
        if (!cuerpo.includes("enable row level security")) continue;
        for (const lit of cuerpo.matchAll(/'(\w+)'/g)) conRls.add(lit[1]!);
      }
    }

    const sinRls = [...creadas.entries()]
      .filter(([tabla]) => !conRls.has(tabla))
      .map(([tabla, f]) => `${tabla} (creada en ${f})`);

    expect(
      sinRls,
      "toda tabla nueva en `public` es alcanzable por la Data API hasta que se le active RLS",
    ).toEqual([]);
  });

  it("ninguna deja una función SECURITY DEFINER sin search_path fijo", () => {
    const infractoras: string[] = [];
    for (const f of archivos) {
      const sql = readFileSync(join(DIR, f), "utf8").toLowerCase();
      // Cada bloque "create function … as $$" hasta el siguiente create/final.
      for (const m of sql.matchAll(/create\s+(?:or replace\s+)?function\s+[^(]+\([^)]*\)([\s\S]*?)\$\$/g)) {
        const cabecera = m[1] ?? "";
        if (cabecera.includes("security definer") && !cabecera.includes("search_path")) {
          infractoras.push(f);
          break;
        }
      }
    }
    expect(
      [...new Set(infractoras)],
      "una función SECURITY DEFINER sin search_path se puede secuestrar con un esquema falso",
    ).toEqual([]);
  });
});
