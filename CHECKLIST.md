# CHECKLIST — UTL 360

## ✅ Implementado (Fase 0–4)

### Fundación
- [x] Proyecto Next.js 15 (App Router, TS estricto, `src/`)
- [x] Tailwind + design system con paleta Pacto Histórico (rojo/dorado/azul)
- [x] Componentes UI base (button, card, input, textarea, label, badge, select, dialog, table, tabs, separator, sonner)
- [x] Clientes Supabase: `client`, `server`, `admin` (service_role, server-only), `middleware`
- [x] Middleware de autenticación + protección de `/dashboard`
- [x] Helpers de sesión y roles (`lib/auth.ts`), matriz de acceso por módulo

### Base de datos y seguridad
- [x] 23 tablas con UUID, timestamps, created_by/updated_by, soft delete
- [x] Enums de dominio (roles, estados, prioridad, contexto, etc.)
- [x] Índices de búsqueda + trigram en `citizens.nombre`
- [x] Triggers `updated_at`
- [x] Funciones helper: `get_my_role`, `has_role`, `is_admin`, `can_manage_area`, `is_staff`
- [x] Radicado automático `JLV-AÑO-000000` (`generate_radicado` + trigger)
- [x] Auditoría genérica (`log_audit_event`) + triggers en tablas clave
- [x] Alta automática de perfil/rol al registrar usuario (`handle_new_user`)
- [x] **RLS habilitado y forzado** en todas las tablas, con políticas por rol
- [x] INSERT público controlado en `citizens`, `requests`, `event_attendees`
- [x] Seed: catálogo de roles, áreas, settings (perfil público) y trayectoria

### Landing pública
- [x] Header responsive + footer con legales y login
- [x] Hero con datos verificados (editables vía `settings`)
- [x] Tarjetas de enfoque, trayectoria, CTA participa, cierre
- [x] Páginas: trayectoria, agenda (eventos públicos), noticias + detalle, territorio, contacto
- [x] Formularios públicos con Zod + consentimiento: registro, solicitud, propuesta
- [x] Confirmación con **código de radicado** + copiar
- [x] Páginas legales (política de datos, términos, transparencia) — borradores

### Plataforma privada
- [x] Login (Supabase Auth) + logout
- [x] Layout con sidebar (filtrado por rol) + topbar
- [x] Panel con 9 KPIs en vivo
- [x] CRM ciudadano (tabla)
- [x] Solicitudes (tabla con radicado, prioridad, estado)
- [x] Tareas (tabla + **crear con diálogo**, CRUD de ejemplo, aviso campaña)
- [x] Calendario (lista de eventos)
- [x] Territorio (lista de zonas)
- [x] IA — **UI mock** con 7 herramientas + aviso human-in-the-loop + log en `ai_logs`
- [x] Comunicaciones, Documentos, Reportes, Configuración — andamiaje con pendientes

## ⏳ Pendientes (Fase 5+)

### CRUD por completar
- [ ] Edición/eliminación (soft delete) con confirmación en ciudadanos y solicitudes
- [ ] Detalle de solicitud + comentarios + asignación de responsable + cambio de estado con auditoría
- [ ] CRUD completo de eventos (con inscripción pública enlazada)
- [ ] CRUD de zonas, líderes y organizaciones
- [ ] Comunicaciones: editor de posts + calendario editorial + flujo de aprobación
- [ ] Documentos: carga a Supabase Storage (bucket privado) + URL firmada + versiones
- [ ] Configuración: editor de perfil público + gestión de usuarios/roles + bitácora

### Integraciones
- [ ] **IA real**: conectar `OPENAI_API_KEY` en `actions/ia.ts` (mantener revisión humana)
- [ ] Email transaccional (Resend) para confirmaciones y radicados
- [ ] Notificaciones push (FCM) y/o WhatsApp Business
- [ ] Google Calendar (sincronización de agenda)
- [ ] GA4 + Search Console (analítica y eventos de conversión)
- [ ] Mapa territorial interactivo (heatmaps por localidad)

### Calidad y producción
- [ ] Tipos generados de Supabase (`supabase gen types`) → reemplazar `types/database.ts`
- [ ] Tests de políticas RLS (acceso por rol) y de server actions
- [ ] Rate limiting / anti-spam en formularios públicos (honeypot, captcha, BotID)
- [ ] Accesibilidad WCAG 2.1 AA (auditoría con teclado y lector de pantalla)
- [ ] SEO: sitemap.ts, robots.ts, JSON-LD (Person, Event, Article)
- [ ] Reportes con exportación CSV/PDF
- [ ] Backups y plan de restauración probado
- [ ] Separación física campaña/institucional (dominio + datos) si aplica jurídicamente

## ⚠️ Notas legales
- No publicar datos biográficos no confirmados (usar placeholders editables).
- Validar textos legales con el área jurídica antes de publicar.
- Revisar la naturaleza jurídica del canal (institucional vs. campaña) antes del lanzamiento.
