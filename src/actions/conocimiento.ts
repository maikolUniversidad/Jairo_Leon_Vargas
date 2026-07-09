"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { embeddingsAvailable } from "@/lib/ia/embeddings";
import { type ActionResult } from "./types";
import type { KbDocument, KbConcept, KbGraph, KbGraphNode, KbGraphLink } from "@/types/database";

const CONFIG_PATH = "/dashboard/configuracion";

export async function listKbDocuments(): Promise<KbDocument[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kb_documents")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data as KbDocument[]) ?? [];
}

export async function getKbStats(): Promise<{
  documentos: number;
  chunks: number;
  conceptos: number;
  embeddings: boolean;
}> {
  const supabase = await createClient();
  const [docs, chunks, conceptos] = await Promise.all([
    supabase.from("kb_documents").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("kb_chunks").select("*", { count: "exact", head: true }),
    supabase.from("kb_concepts").select("*", { count: "exact", head: true }),
  ]);
  return {
    documentos: docs.count ?? 0,
    chunks: chunks.count ?? 0,
    conceptos: conceptos.count ?? 0,
    embeddings: embeddingsAvailable(),
  };
}

export async function listKbConcepts(): Promise<KbConcept[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("kb_concepts")
    .select("*")
    .order("weight", { ascending: false })
    .limit(500);
  return (data as KbConcept[]) ?? [];
}

/** Elimina un documento (y sus fragmentos/relaciones por cascade) + su archivo. */
export async function deleteKbDocument(id: string): Promise<ActionResult> {
  const admin = createAdminClient();
  const { data: doc } = await admin.from("kb_documents").select("storage_path").eq("id", id).maybeSingle();

  if (doc?.storage_path) {
    try {
      await admin.storage.from("conocimiento").remove([doc.storage_path]);
    } catch { /* opcional */ }
  }

  const { error } = await admin.from("kb_documents").delete().eq("id", id);
  if (error) return { ok: false, message: "No se pudo eliminar el documento." };

  // Limpia conceptos huérfanos.
  await limpiarConceptos(admin);

  revalidatePath(CONFIG_PATH);
  return { ok: true, message: "Documento eliminado de la base de conocimiento." };
}

/** Borra conceptos que ya no pertenecen a ningún documento. */
async function limpiarConceptos(admin: ReturnType<typeof createAdminClient>) {
  const { data: usados } = await admin.from("kb_doc_concepts").select("concept_id");
  const enUso = new Set((usados ?? []).map((r) => r.concept_id as string));
  const { data: todos } = await admin.from("kb_concepts").select("id");
  const huerfanos = (todos ?? []).map((c) => c.id as string).filter((id) => !enUso.has(id));
  if (huerfanos.length) await admin.from("kb_concepts").delete().in("id", huerfanos);
}

/**
 * Construye el grafo de conocimiento. Nodos = documentos + conceptos.
 * Enlaces = documento↔concepto y concepto↔concepto (co-ocurrencia en un doc).
 * Filtros opcionales: por documento o por concepto (vecindario a 1 salto).
 */
export async function getKnowledgeGraph(filter?: {
  documentId?: string;
  conceptId?: string;
}): Promise<KbGraph> {
  const supabase = await createClient();
  const [{ data: docsRaw }, { data: conRaw }, { data: dcRaw }] = await Promise.all([
    supabase.from("kb_documents").select("id, titulo, chunks_count").is("deleted_at", null).limit(1000),
    supabase.from("kb_concepts").select("id, nombre, weight").order("weight", { ascending: false }).limit(400),
    supabase.from("kb_doc_concepts").select("document_id, concept_id, weight").limit(5000),
  ]);

  const docs = (docsRaw ?? []) as { id: string; titulo: string; chunks_count: number }[];
  const concepts = (conRaw ?? []) as { id: string; nombre: string; weight: number }[];
  const dc = (dcRaw ?? []) as { document_id: string; concept_id: string; weight: number }[];

  const docById = new Map(docs.map((d) => [d.id, d]));
  const conById = new Map(concepts.map((c) => [c.id, c]));

  // Concept sets por documento (para co-ocurrencia).
  const conceptosPorDoc = new Map<string, string[]>();
  for (const r of dc) {
    if (!docById.has(r.document_id) || !conById.has(r.concept_id)) continue;
    const arr = conceptosPorDoc.get(r.document_id) ?? [];
    arr.push(r.concept_id);
    conceptosPorDoc.set(r.document_id, arr);
  }

  // Determina qué documentos/conceptos incluir según el filtro.
  let docsIncl = new Set(docs.map((d) => d.id));
  let consIncl = new Set(concepts.map((c) => c.id));

  if (filter?.documentId) {
    const cs = new Set(conceptosPorDoc.get(filter.documentId) ?? []);
    docsIncl = new Set([filter.documentId]);
    consIncl = cs;
    // Otros documentos que comparten esos conceptos (1 salto).
    for (const [docId, cids] of conceptosPorDoc) {
      if (cids.some((c) => cs.has(c))) docsIncl.add(docId);
    }
  } else if (filter?.conceptId) {
    const cid = filter.conceptId;
    consIncl = new Set([cid]);
    docsIncl = new Set<string>();
    for (const [docId, cids] of conceptosPorDoc) {
      if (cids.includes(cid)) {
        docsIncl.add(docId);
        for (const c of cids) consIncl.add(c); // co-conceptos
      }
    }
  }

  // Nodos
  const nodes: KbGraphNode[] = [];
  for (const d of docs) {
    if (!docsIncl.has(d.id)) continue;
    nodes.push({ id: `d:${d.id}`, tipo: "documento", label: d.titulo, val: Math.max(2, Math.min(12, d.chunks_count || 2)) });
  }
  for (const c of concepts) {
    if (!consIncl.has(c.id)) continue;
    nodes.push({ id: `c:${c.id}`, tipo: "concepto", label: c.nombre, val: Math.max(3, Math.min(16, (c.weight || 1) * 2)) });
  }

  // Enlaces documento↔concepto
  const links: KbGraphLink[] = [];
  for (const r of dc) {
    if (!docsIncl.has(r.document_id) || !consIncl.has(r.concept_id)) continue;
    links.push({ source: `d:${r.document_id}`, target: `c:${r.concept_id}`, tipo: "doc-concepto", weight: r.weight });
  }

  // Enlaces concepto↔concepto (co-ocurrencia)
  const coocur = new Map<string, number>();
  for (const [docId, cids] of conceptosPorDoc) {
    if (!docsIncl.has(docId)) continue;
    const inc = cids.filter((c) => consIncl.has(c));
    for (let i = 0; i < inc.length; i++) {
      for (let j = i + 1; j < inc.length; j++) {
        const [a, b] = [inc[i]!, inc[j]!].sort();
        const key = `${a}|${b}`;
        coocur.set(key, (coocur.get(key) ?? 0) + 1);
      }
    }
  }
  for (const [key, w] of coocur) {
    const [a, b] = key.split("|");
    links.push({ source: `c:${a}`, target: `c:${b}`, tipo: "concepto-concepto", weight: w });
  }

  return { nodes, links };
}
