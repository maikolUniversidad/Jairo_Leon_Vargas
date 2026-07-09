-- ============================================================================
-- UTL 360 · 0025_rag.sql
-- Base de conocimiento (RAG) con pgvector + grafo de conocimiento.
--   · kb_documents    : archivos subidos (metadatos + estado de procesamiento).
--   · kb_chunks       : fragmentos con su embedding (vector 1536, OpenAI small).
--   · kb_concepts     : conceptos/entidades extraídos por IA.
--   · kb_doc_concepts : relación documento ↔ concepto (peso).
--   · match_kb_chunks : búsqueda semántica por similitud coseno (para el chat).
-- Gestión: solo admins. Lectura: staff (para que el Asistente IA recupere).
-- Ejecuta DESPUÉS de 0024. Idempotente.
-- ============================================================================

create extension if not exists vector;

do $$ begin
  create type kb_estado as enum ('procesando','listo','error');
exception when duplicate_object then null; end $$;

-- ─────────────── Documentos ───────────────
create table if not exists public.kb_documents (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  filename     text,
  mime         text,
  tipo         text,                                  -- pdf|docx|xlsx|csv|txt|md|json
  bytes        bigint not null default 0,
  storage_path text,
  chunks_count int not null default 0,
  resumen      text,                                  -- resumen corto (IA)
  estado       kb_estado not null default 'procesando',
  error        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists idx_kb_documents_estado on public.kb_documents(estado);
create index if not exists idx_kb_documents_created on public.kb_documents(created_at desc);

-- ─────────────── Fragmentos + embeddings ───────────────
create table if not exists public.kb_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.kb_documents(id) on delete cascade,
  idx         int not null default 0,
  content     text not null,
  tokens      int not null default 0,
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);
create index if not exists idx_kb_chunks_doc on public.kb_chunks(document_id, idx);
-- Índice HNSW para búsqueda coseno rápida (pgvector >= 0.5).
create index if not exists idx_kb_chunks_embedding on public.kb_chunks
  using hnsw (embedding vector_cosine_ops);

-- ─────────────── Conceptos (nodos del grafo) ───────────────
create table if not exists public.kb_concepts (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  slug       text not null unique,                    -- nombre normalizado (lower, sin tildes)
  weight     int not null default 0,                  -- nº de documentos donde aparece
  created_at timestamptz not null default now()
);

create table if not exists public.kb_doc_concepts (
  document_id uuid not null references public.kb_documents(id) on delete cascade,
  concept_id  uuid not null references public.kb_concepts(id) on delete cascade,
  weight      int not null default 1,
  primary key (document_id, concept_id)
);
create index if not exists idx_kb_doc_concepts_concept on public.kb_doc_concepts(concept_id);

-- ─────────────── Búsqueda semántica (para el RAG del chat) ───────────────
create or replace function public.match_kb_chunks(
  query_embedding vector(1536),
  match_count int default 6,
  similarity_threshold float default 0.2
) returns table (
  chunk_id uuid,
  document_id uuid,
  titulo text,
  content text,
  similarity float
) language sql stable security definer set search_path = public as $$
  select c.id, c.document_id, d.titulo, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.kb_chunks c
  join public.kb_documents d on d.id = c.document_id
  where d.deleted_at is null
    and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) > similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
grant execute on function public.match_kb_chunks(vector, int, float) to authenticated;

-- ─────────────── RLS: gestión solo admin, lectura staff ───────────────
alter table public.kb_documents    enable row level security;
alter table public.kb_documents    force row level security;
alter table public.kb_chunks        enable row level security;
alter table public.kb_chunks        force row level security;
alter table public.kb_concepts      enable row level security;
alter table public.kb_concepts      force row level security;
alter table public.kb_doc_concepts  enable row level security;
alter table public.kb_doc_concepts  force row level security;

drop policy if exists kb_documents_read on public.kb_documents;
create policy kb_documents_read on public.kb_documents for select to authenticated
  using (public.is_staff() and deleted_at is null);
drop policy if exists kb_documents_write on public.kb_documents;
create policy kb_documents_write on public.kb_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists kb_chunks_read on public.kb_chunks;
create policy kb_chunks_read on public.kb_chunks for select to authenticated
  using (public.is_staff());
drop policy if exists kb_chunks_write on public.kb_chunks;
create policy kb_chunks_write on public.kb_chunks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists kb_concepts_read on public.kb_concepts;
create policy kb_concepts_read on public.kb_concepts for select to authenticated
  using (public.is_staff());
drop policy if exists kb_concepts_write on public.kb_concepts;
create policy kb_concepts_write on public.kb_concepts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists kb_doc_concepts_read on public.kb_doc_concepts;
create policy kb_doc_concepts_read on public.kb_doc_concepts for select to authenticated
  using (public.is_staff());
drop policy if exists kb_doc_concepts_write on public.kb_doc_concepts;
create policy kb_doc_concepts_write on public.kb_doc_concepts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─────────────── Trigger updated_at ───────────────
drop trigger if exists trg_kb_documents_updated on public.kb_documents;
create trigger trg_kb_documents_updated before update on public.kb_documents
  for each row execute function public.set_updated_at();

-- ─────────────── Bucket privado para los archivos originales ───────────────
insert into storage.buckets (id, name, public)
values ('conocimiento', 'conocimiento', false)
on conflict (id) do nothing;
