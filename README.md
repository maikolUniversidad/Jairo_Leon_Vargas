# UTL 360 — Plataforma de Jairo León Vargas

Plataforma integral de **gestión territorial, ciudadana, comunicacional y organizativa**: una
**landing page pública** + una **plataforma privada (UTL)** con CRM, solicitudes, tareas,
agenda, territorio, comunicaciones, documentos, reportes e IA (mock).

## Stack

- **Next.js 15** (App Router) · **TypeScript** estricto
- **Tailwind CSS** + componentes estilo **shadcn/ui**
- **Supabase**: PostgreSQL · Auth · Storage · **Row Level Security**
- **React Hook Form** + **Zod**
- **Vercel** (frontend) + **Supabase** (backend)

## Estructura

```
supabase/migrations/   SQL: esquema, funciones, RLS, seed
src/
  app/
    (public)/          Landing y páginas públicas
    login/             Acceso del equipo
    dashboard/         Plataforma privada (protegida)
  components/ ui · landing · dashboard · forms
  lib/ supabase/{client,server,admin,middleware} · auth · validations · settings · status · utils
  actions/             Server actions (formularios, auth, tareas, IA)
  types/ database · roles
  middleware.ts        Protege /dashboard y refresca sesión
```

## Puesta en marcha

### 1. Dependencias
```bash
npm install
```

### 2. Crear proyecto en Supabase
- Crea un proyecto en https://supabase.com
- Copia **Project URL** y **anon key** (Project Settings → API)
- Copia la **service_role key** (solo para el servidor)

### 3. Variables de entorno
```bash
cp .env.example .env.local
```
Completa:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # NUNCA en el cliente
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Ejecutar migraciones SQL
En el **SQL Editor** de Supabase, ejecuta **en orden**:
1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_functions.sql`
3. `supabase/migrations/0003_rls.sql`
4. `supabase/migrations/0004_seed.sql`

> O con la CLI: `supabase db push` (requiere `supabase link`).

### 5. Crear el primer usuario admin
1. Crea un usuario en **Authentication → Users → Add user** (email + contraseña).
   - El trigger `handle_new_user` crea su `profile` y le asigna el rol `consulta`.
2. Elévalo a admin desde el SQL Editor:
```sql
update public.user_roles
set role = 'super_admin'
where user_id = (select id from auth.users where email = 'TU_EMAIL');
```

### 6. Levantar el proyecto
```bash
npm run dev
```
- Landing: http://localhost:3000
- Login equipo: http://localhost:3000/login

## Despliegue en Vercel

1. Sube el repo a GitHub.
2. En Vercel → New Project → importa el repo.
3. Agrega las variables de entorno (mismas que `.env.local`).
4. En Supabase → Authentication → URL Configuration, agrega tu dominio de Vercel
   a *Site URL* y *Redirect URLs*.
5. Deploy.

## Seguridad (resumen)

- **RLS habilitado y forzado** en todas las tablas (deny by default).
- Formularios públicos: **solo INSERT** controlado en `citizens`, `requests`, `event_attendees`
  (exigen consentimiento). **Sin SELECT público** de datos sensibles.
- `service_role` **solo en el servidor** (`lib/supabase/admin.ts` con `server-only`).
- `/dashboard` protegido por middleware **y** por `requireUser()` en el layout.
- Auditoría automática (`audit_logs`) vía triggers; soft delete con `deleted_at`.
- Radicado automático `JLV-AÑO-000000` por trigger en BD.

## Separación institucional vs. campaña

Cada registro lleva `contexto_operativo` (`institucional`, `campana`, `comunitario`,
`interno`, `comunicacional`). La UI advierte al crear contenido de campaña para no
mezclarlo con gestión institucional (mitiga riesgo legal).

Ver **CHECKLIST.md** para el estado y los pendientes.
