-- ============================================================================
-- UTL 360 · 0028_misredes_linktree.sql
-- Configuración editable de la página pública /misredes (estilo Linktree).
-- Lectura pública (no sensible); escritura solo para el equipo de comunicaciones.
-- ============================================================================

create table if not exists public.linktree_config (
  id         int primary key default 1,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.linktree_config enable row level security;
alter table public.linktree_config force row level security;

-- Lectura pública: la página la carga con la anon key.
drop policy if exists linktree_read on public.linktree_config;
create policy linktree_read on public.linktree_config for select to anon, authenticated
  using (true);

-- Escritura: solo quien gestiona comunicaciones (admin/dirección/coordinación/comunicaciones).
drop policy if exists linktree_write on public.linktree_config;
create policy linktree_write on public.linktree_config for all to authenticated
  using (public.can_manage_comunicaciones())
  with check (public.can_manage_comunicaciones());

insert into public.linktree_config (id, data)
values (1, '{}'::jsonb)
on conflict (id) do nothing;
