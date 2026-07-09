import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { collectForPerson, type CollectMode } from "./collectors";

export interface PersonForRun {
  id: string;
  nombre: string;
  alias?: string[] | null;
  keywords?: string[] | null;
  handles?: Record<string, string> | null;
}

export interface RunResult {
  inserted: number;
  perSource: Record<string, string>;
}

/**
 * Recolecta menciones de una persona desde todas las fuentes disponibles,
 * deduplica contra lo ya guardado, inserta lo nuevo y registra la corrida
 * (monitor_runs) con el informe por fuente. Reutilizable por el server action
 * (cliente del usuario) y por el cron (cliente admin).
 */
export async function runCollectionFor(
  client: SupabaseClient,
  person: PersonForRun,
  createdBy: string | null,
  mode: CollectMode = "recent",
): Promise<RunResult> {
  const results = await collectForPerson(
    {
      nombre: person.nombre,
      alias: person.alias ?? [],
      keywords: person.keywords ?? [],
      handles: person.handles ?? {},
    },
    mode,
  );

  const { data: existing } = await client
    .from("monitor_items")
    .select("url")
    .eq("person_id", person.id)
    .not("url", "is", null);
  const seen = new Set((existing as { url: string }[] ?? []).map((e) => e.url));

  const perSource: Record<string, string> = {};
  const rows: Record<string, unknown>[] = [];
  for (const r of results) {
    perSource[r.fuente] = r.status;
    for (const it of r.items) {
      if (!it.url || seen.has(it.url)) continue;
      seen.add(it.url);
      rows.push({
        person_id: person.id,
        fuente: it.fuente,
        tipo: it.tipo,
        titulo: it.titulo,
        contenido: it.contenido ?? null,
        url: it.url,
        autor: it.autor ?? null,
        autor_handle: it.autor_handle ?? null,
        published_at: it.published_at ?? null,
        created_by: createdBy,
      });
    }
  }

  for (let i = 0; i < rows.length; i += 200) {
    await client.from("monitor_items").insert(rows.slice(i, i + 200));
  }

  await client
    .from("monitor_persons")
    .update({ ultima_recoleccion: new Date().toISOString() })
    .eq("id", person.id);

  await client.from("monitor_runs").insert({
    person_id: person.id,
    fuentes: results.map((r) => r.fuente),
    total: rows.length,
    resultado: perSource,
    tipo: mode === "sweep" ? "barrido" : "reciente",
    created_by: createdBy,
  });

  return { inserted: rows.length, perSource };
}

/**
 * Decide si una persona con programación automática debe recolectarse ahora.
 * `horaCO` = hora local de Colombia (0-23). `now` = instante actual.
 */
export function isDue(
  p: { auto_frecuencia: string; auto_hora: number; ultima_recoleccion: string | null },
  horaCO: number,
  now: Date,
): boolean {
  const last = p.ultima_recoleccion ? new Date(p.ultima_recoleccion) : null;
  const minutes = last ? (now.getTime() - last.getTime()) / 60000 : Infinity;
  switch (p.auto_frecuencia) {
    case "cada_hora":
      return minutes >= 55;
    case "cada_6h":
      return minutes >= 6 * 60 - 5;
    case "cada_12h":
      return minutes >= 12 * 60 - 5;
    case "diario":
      return horaCO === p.auto_hora && minutes >= 20 * 60;
    default:
      return false;
  }
}
