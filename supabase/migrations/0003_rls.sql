-- ============================================================================
-- UTL 360 · 0003_rls.sql
-- Row Level Security: habilitación + políticas por rol.
-- Principio: DENY BY DEFAULT. Nada es legible sin política explícita.
-- Ejecuta DESPUÉS de 0002_functions.sql.
-- ============================================================================

-- Habilitar RLS en TODAS las tablas
do $$
declare t text;
begin
  foreach t in array array[
    'areas','profiles','roles','user_roles','citizens','citizen_tags','requests',
    'request_comments','tasks','task_comments','task_checklist','zones','zone_leaders',
    'organizations','events','event_attendees','documents','content_posts',
    'content_calendar','ai_logs','notifications','audit_logs','settings'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end $$;

-- ───────────── Catálogos (lectura autenticada, escritura admin) ─────────────
drop policy if exists areas_read on public.areas;
create policy areas_read on public.areas for select to authenticated using (true);
drop policy if exists areas_admin on public.areas;
create policy areas_admin on public.areas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select to authenticated using (true);
drop policy if exists roles_admin on public.roles;
create policy roles_admin on public.roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated using (true);
-- Lectura pública SOLO de claves no sensibles (perfil/contacto de la landing)
drop policy if exists settings_public_read on public.settings;
create policy settings_public_read on public.settings for select to anon
  using (key in ('perfil_publico','contacto'));
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ───────────── profiles ─────────────
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ───────────── user_roles (solo admin gestiona; cada quien ve los suyos) ─────────────
drop policy if exists user_roles_self_read on public.user_roles;
create policy user_roles_self_read on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists user_roles_admin on public.user_roles;
create policy user_roles_admin on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ───────────── citizens (CRM) ─────────────
-- INSERT público controlado desde formularios de la landing (requiere consentimiento)
drop policy if exists citizens_public_insert on public.citizens;
create policy citizens_public_insert on public.citizens for insert to anon
  with check (consentimiento_datos = true);
-- Staff de atención/territorio + admins leen y gestionan
drop policy if exists citizens_staff_read on public.citizens;
create policy citizens_staff_read on public.citizens for select to authenticated
  using (
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('atencion_ciudadana'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('gestor_territorial'::app_role)
    or public.has_role('analitica_reportes'::app_role)
  );
drop policy if exists citizens_staff_write on public.citizens;
create policy citizens_staff_write on public.citizens for insert to authenticated
  with check (
    public.is_admin()
    or public.has_role('atencion_ciudadana'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('gestor_territorial'::app_role)
  );
drop policy if exists citizens_staff_update on public.citizens;
create policy citizens_staff_update on public.citizens for update to authenticated
  using (
    public.is_admin()
    or public.has_role('atencion_ciudadana'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('gestor_territorial'::app_role)
  ) with check (true);

-- ───────────── requests (solicitudes) ─────────────
drop policy if exists requests_public_insert on public.requests;
create policy requests_public_insert on public.requests for insert to anon
  with check (estado = 'recibida');
drop policy if exists requests_staff_read on public.requests;
create policy requests_staff_read on public.requests for select to authenticated
  using (
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('juridico_legislativo'::app_role)
    or public.has_role('atencion_ciudadana'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('gestor_territorial'::app_role)
    or public.has_role('analitica_reportes'::app_role)
    or responsable_id = auth.uid()
  );
drop policy if exists requests_staff_insert on public.requests;
create policy requests_staff_insert on public.requests for insert to authenticated
  with check (public.is_staff());
drop policy if exists requests_staff_update on public.requests;
create policy requests_staff_update on public.requests for update to authenticated
  using (
    public.is_admin()
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('juridico_legislativo'::app_role)
    or public.has_role('atencion_ciudadana'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or responsable_id = auth.uid()
  ) with check (true);

drop policy if exists request_comments_staff on public.request_comments;
create policy request_comments_staff on public.request_comments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ───────────── tasks ─────────────
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated
  using (public.is_staff());
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_staff());
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (
    public.is_admin()
    or public.has_role('coordinador_utl'::app_role)
    or responsable_id = auth.uid()
    or creador_id = auth.uid()
  ) with check (true);
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_admin() or public.has_role('coordinador_utl'::app_role));

drop policy if exists task_comments_staff on public.task_comments;
create policy task_comments_staff on public.task_comments for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists task_checklist_staff on public.task_checklist;
create policy task_checklist_staff on public.task_checklist for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ───────────── zones / territorio ─────────────
drop policy if exists zones_read on public.zones;
create policy zones_read on public.zones for select to authenticated using (public.is_staff());
drop policy if exists zones_write on public.zones;
create policy zones_write on public.zones for all to authenticated
  using (
    public.is_admin()
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('coordinador_utl'::app_role)
  ) with check (
    public.is_admin()
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('coordinador_utl'::app_role)
  );

drop policy if exists zone_leaders_staff on public.zone_leaders;
create policy zone_leaders_staff on public.zone_leaders for all to authenticated
  using (public.is_staff())
  with check (public.is_admin() or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('gestor_territorial'::app_role));

drop policy if exists organizations_staff on public.organizations;
create policy organizations_staff on public.organizations for all to authenticated
  using (public.is_staff())
  with check (public.is_admin() or public.has_role('coordinador_territorial'::app_role));

-- ───────────── events / agenda ─────────────
-- Público: solo eventos públicos confirmados/realizados (para la agenda de la landing)
drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events for select to anon
  using (visibilidad = 'publica' and estado in ('confirmado','reprogramado','realizado')
         and deleted_at is null);
drop policy if exists events_staff_read on public.events;
create policy events_staff_read on public.events for select to authenticated
  using (public.is_staff());
drop policy if exists events_write on public.events;
create policy events_write on public.events for all to authenticated
  using (
    public.is_admin()
    or public.has_role('coordinador_utl'::app_role)
    or public.has_role('coordinador_territorial'::app_role)
    or public.has_role('comunicaciones'::app_role)
    or responsable_id = auth.uid()
  ) with check (public.is_staff());

-- Inscripción pública a eventos (INSERT controlado, sin SELECT público)
drop policy if exists event_attendees_public_insert on public.event_attendees;
create policy event_attendees_public_insert on public.event_attendees for insert to anon
  with check (consentimiento_datos = true);
drop policy if exists event_attendees_staff on public.event_attendees;
create policy event_attendees_staff on public.event_attendees for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ───────────── documents ─────────────
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated
  using (
    public.is_staff() and (
      confidencialidad <> 'reservado'
      or public.is_admin()
      or public.has_role('direccion_general'::app_role)
      or public.has_role('juridico_legislativo'::app_role)
      or creado_por = auth.uid()
    )
  );
drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents for all to authenticated
  using (
    public.is_admin()
    or public.has_role('juridico_legislativo'::app_role)
    or public.has_role('comunicaciones'::app_role)
    or public.has_role('coordinador_utl'::app_role)
    or creado_por = auth.uid()
  ) with check (public.is_staff());

-- ───────────── content_posts / comunicaciones ─────────────
-- Público: solo publicaciones públicas y publicadas (noticias de la landing)
drop policy if exists content_public_read on public.content_posts;
create policy content_public_read on public.content_posts for select to anon
  using (visibilidad = 'publica' and estado = 'publicado' and deleted_at is null);
drop policy if exists content_staff_read on public.content_posts;
create policy content_staff_read on public.content_posts for select to authenticated
  using (public.is_staff());
drop policy if exists content_write on public.content_posts;
create policy content_write on public.content_posts for all to authenticated
  using (
    public.is_admin()
    or public.has_role('comunicaciones'::app_role)
    or public.has_role('coordinador_utl'::app_role)
  ) with check (
    public.is_admin()
    or public.has_role('comunicaciones'::app_role)
    or public.has_role('coordinador_utl'::app_role)
  );

drop policy if exists content_calendar_staff on public.content_calendar;
create policy content_calendar_staff on public.content_calendar for all to authenticated
  using (public.is_staff())
  with check (public.is_admin() or public.has_role('comunicaciones'::app_role)
    or public.has_role('coordinador_utl'::app_role));

-- ───────────── ai_logs / notifications ─────────────
drop policy if exists ai_logs_owner on public.ai_logs;
create policy ai_logs_owner on public.ai_logs for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_owner on public.notifications;
create policy notifications_owner on public.notifications for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────── audit_logs (solo lectura admin/dirección/control) ─────────────
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated
  using (
    public.is_admin()
    or public.has_role('direccion_general'::app_role)
  );
-- Sin política de INSERT para clientes: los inserta el trigger (SECURITY DEFINER).
