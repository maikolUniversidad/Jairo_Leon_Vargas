import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractDocumentText } from "@/lib/kb/extract";
import { chunkText } from "@/lib/kb/chunk";
import { extractConcepts, slugifyConcept } from "@/lib/kb/concepts";
import { embedTexts, embeddingsAvailable } from "@/lib/ia/embeddings";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_CHUNKS = 400; // límite por documento (coste/tiempo)

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Solo administradores pueden subir documentos." }, { status: 403 });

  let file: File | null = null;
  let titulo = "";
  try {
    const form = await req.formData();
    file = form.get("file") as File | null;
    titulo = String(form.get("titulo") ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });

  const admin = createAdminClient();
  const filename = file.name || "documento";
  const mime = file.type || "";
  const buffer = Buffer.from(await file.arrayBuffer());

  // 1) Extraer texto
  let text = "";
  let tipo = "";
  try {
    const r = await extractDocumentText(buffer, filename, mime);
    text = r.text;
    tipo = r.tipo;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo extraer el texto." }, { status: 422 });
  }
  if (!text.trim()) {
    return NextResponse.json({ error: "El documento no contiene texto extraíble." }, { status: 422 });
  }

  // 2) Crear el documento (estado: procesando)
  const { data: doc, error: docErr } = await admin
    .from("kb_documents")
    .insert({
      titulo: titulo || filename,
      filename,
      mime,
      tipo,
      bytes: buffer.byteLength,
      estado: "procesando",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (docErr || !doc) {
    return NextResponse.json({ error: "No se pudo registrar el documento." }, { status: 500 });
  }
  const documentId = doc.id as string;

  try {
    // 3) Guardar el original en el bucket privado (best-effort)
    let storagePath: string | null = null;
    try {
      const path = `${documentId}/${filename}`;
      const up = await admin.storage.from("conocimiento").upload(path, buffer, {
        contentType: mime || "application/octet-stream",
        upsert: true,
      });
      if (!up.error) storagePath = path;
    } catch { /* opcional */ }

    // 4) Chunking
    let chunks = chunkText(text);
    let truncado = false;
    if (chunks.length > MAX_CHUNKS) {
      chunks = chunks.slice(0, MAX_CHUNKS);
      truncado = true;
    }

    // 5) Embeddings (si hay llave)
    let embeddings: number[][] = [];
    if (embeddingsAvailable()) {
      embeddings = await embedTexts(chunks.map((c) => c.content));
    }

    // 6) Insertar chunks (embedding como literal pgvector)
    const filas = chunks.map((c, i) => ({
      document_id: documentId,
      idx: i,
      content: c.content,
      tokens: c.tokens,
      embedding: embeddings[i] ? `[${embeddings[i]!.join(",")}]` : null,
    }));
    for (let i = 0; i < filas.length; i += 100) {
      const { error } = await admin.from("kb_chunks").insert(filas.slice(i, i + 100));
      if (error) throw new Error(`Error guardando fragmentos: ${error.message}`);
    }

    // 7) Conceptos + relaciones (grafo)
    const { resumen, conceptos } = await extractConcepts(text);
    for (const nombre of conceptos) {
      const slug = slugifyConcept(nombre);
      if (!slug) continue;
      const { data: con } = await admin
        .from("kb_concepts")
        .upsert({ nombre, slug }, { onConflict: "slug" })
        .select("id")
        .single();
      if (!con) continue;
      await admin.from("kb_doc_concepts").upsert(
        { document_id: documentId, concept_id: con.id, weight: 1 },
        { onConflict: "document_id,concept_id" },
      );
      // weight = nº de documentos donde aparece el concepto
      const { count } = await admin
        .from("kb_doc_concepts")
        .select("*", { count: "exact", head: true })
        .eq("concept_id", con.id);
      await admin.from("kb_concepts").update({ weight: count ?? 1 }).eq("id", con.id);
    }

    // 8) Documento listo
    await admin
      .from("kb_documents")
      .update({
        estado: "listo",
        chunks_count: chunks.length,
        resumen,
        storage_path: storagePath,
        error: truncado ? `Documento largo: se indexaron los primeros ${MAX_CHUNKS} fragmentos.` : null,
      })
      .eq("id", documentId);

    return NextResponse.json({
      documentId,
      chunks: chunks.length,
      conceptos: conceptos.length,
      embeddings: embeddings.length > 0,
      truncado,
    });
  } catch (e) {
    await admin
      .from("kb_documents")
      .update({ estado: "error", error: e instanceof Error ? e.message.slice(0, 400) : "Error de procesamiento." })
      .eq("id", documentId);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error procesando el documento." }, { status: 500 });
  }
}
