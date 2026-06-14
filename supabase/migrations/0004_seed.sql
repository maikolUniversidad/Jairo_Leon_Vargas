-- ============================================================================
-- UTL 360 · 0004_seed.sql
-- Datos iniciales: catálogo de roles, áreas, settings y placeholders de contenido.
-- Ejecuta DESPUÉS de 0003_rls.sql. Idempotente.
-- ============================================================================

-- Catálogo de roles (descripciones)
insert into public.roles (role, descripcion) values
  ('super_admin','Acceso total al sistema y configuraciones críticas'),
  ('administrador','Gestión total excepto configuraciones críticas'),
  ('direccion_general','Lectura total y aprobación estratégica'),
  ('coordinador_utl','Coordinación de áreas, tareas, agenda y reportes'),
  ('juridico_legislativo','Documentos, solicitudes formales y respuestas'),
  ('comunicaciones','Contenidos, noticias, piezas y calendario editorial'),
  ('coordinador_territorial','Zonas, eventos, líderes y solicitudes territoriales'),
  ('gestor_territorial','Gestión limitada por zona asignada'),
  ('atencion_ciudadana','CRM ciudadano y solicitudes'),
  ('analitica_reportes','Lectura y reportes'),
  ('voluntario','Acceso limitado a tareas asignadas y eventos'),
  ('consulta','Solo lectura')
on conflict (role) do update set descripcion = excluded.descripcion;

-- Áreas base
insert into public.areas (nombre, descripcion) values
  ('Dirección General','Despacho y dirección política'),
  ('Coordinación UTL','Coordinación de la Unidad de Trabajo Legislativo'),
  ('Jurídico / Legislativo','Soporte jurídico y legislativo'),
  ('Comunicaciones','Estrategia, contenidos y prensa'),
  ('Territorial','Gestión territorial y comunitaria'),
  ('Atención Ciudadana','Atención y CRM'),
  ('Analítica','Reportes y datos')
on conflict (nombre) do nothing;

-- Settings / placeholders editables del perfil público (NO inventar biografía)
insert into public.settings (key, value, descripcion) values
  ('perfil_publico',
   jsonb_build_object(
     'nombre','Jairo León Vargas',
     'cargo_aspiracion','Candidato a Cámara por Bogotá D.C.',
     'movimiento','Pacto Histórico / Colombia Humana',
     'renglon','106',
     'lema','Una voz desde el territorio para construir con la gente',
     'subtitulo','Gestión social, participación ciudadana y trabajo comunitario para Bogotá y Colombia.',
     'biografia_corta','[Pendiente de edición en el CMS] Trayectoria pública con experiencia territorial y social en Bogotá y en programas de articulación de oferta social.',
     'foto_url','',
     'redes', jsonb_build_object('facebook','','instagram','','x','','tiktok','','youtube','')
   ),
   'Datos públicos editables del perfil de la landing'),
  ('contacto',
   jsonb_build_object('email','', 'telefono','', 'direccion',''),
   'Datos de contacto públicos'),
  ('contexto_operativo_default', '"institucional"'::jsonb,
   'Contexto operativo por defecto para nuevos registros')
on conflict (key) do nothing;

-- Trayectoria verificada (placeholders basados SOLO en datos públicos confirmados)
insert into public.content_posts (titulo, slug, tipo, categoria, resumen, estado, visibilidad, contexto_operativo, fecha_publicacion)
values
  ('Alcalde Local de San Cristóbal','trayectoria-san-cristobal','trayectoria','Gestión territorial',
   'Experiencia como Alcalde Local de San Cristóbal, con gestión territorial y social.',
   'borrador','interna','institucional', null),
  ('Director de Oferta Social – Prosperidad Social','trayectoria-prosperidad-social','trayectoria','Articulación institucional',
   'Director de Oferta Social / Director de Gestión y Articulación de la Oferta Social en Prosperidad Social.',
   'borrador','interna','institucional', null),
  ('Candidato a Cámara por Bogotá D.C. – Renglón 106','trayectoria-candidatura','trayectoria','Participación',
   'Candidatura a la Cámara de Representantes por Bogotá D.C. en el entorno del Pacto Histórico.',
   'borrador','interna','campana', null)
on conflict (slug) do nothing;
