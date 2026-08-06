-- ============================================================================
-- UTL 360 · 0030_contactos_datos_extra.sql
-- Amplía la ficha de contacto con datos secundarios, redes sociales, datos
-- personales y un campo libre.
--
-- Criterio: TODO es opcional. Un contacto puede no tener teléfono ni correo y
-- aun así guardarse — lo único obligatorio sigue siendo el nombre.
--
-- Ejecuta DESPUÉS de 0010_contactos.sql. Idempotente.
-- ============================================================================

alter table public.contacts
  -- Segundo canal de contacto (celular personal + fijo de oficina, etc.)
  add column if not exists telefono_2       text,
  add column if not exists email_2          text,
  -- Redes sociales y web. Se guarda el usuario o la URL completa, indistinto.
  add column if not exists facebook         text,
  add column if not exists instagram        text,
  add column if not exists x_twitter        text,
  add column if not exists tiktok           text,
  add column if not exists sitio_web        text,
  -- Datos personales
  add column if not exists documento        text,
  add column if not exists fecha_nacimiento date,
  add column if not exists genero           text,
  -- Cajón de sastre para lo que no encaje en ningún campo anterior
  add column if not exists otros_datos      text;

comment on column public.contacts.otros_datos is
  'Texto libre para datos que no encajan en los campos anteriores.';
comment on column public.contacts.fecha_nacimiento is
  'Sirve para recordatorios de cumpleaños.';

-- Búsqueda por documento (cruce con ciudadanos) y por cumpleaños del mes.
create index if not exists contacts_documento_idx
  on public.contacts (documento)
  where documento is not null;

create index if not exists contacts_fecha_nacimiento_idx
  on public.contacts (fecha_nacimiento)
  where fecha_nacimiento is not null;
