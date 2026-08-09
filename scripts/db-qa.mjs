// ============================================================================
// UTL 360 · QA automatizado de la base de datos (Supabase / Postgres).
//
// Uso:
//   npm run qa:db              → reporte en consola + docs/qa/db-qa-latest.{md,json}
//   npm run qa:db -- --json    → solo JSON por stdout (para CI)
//   npm run qa:db -- --quiet   → solo el resumen y las banderas que no están OK
//
// Banderas:  🟢 OK   ·   🟡 AVISO   ·   🔴 FALLA
// Código de salida: 0 si no hay 🔴 · 1 si hay al menos una 🔴 (sirve de gate en CI).
//
// Requiere DATABASE_URL en el entorno (.env.local).
// ============================================================================
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import {
  BUCKETS_ESPERADOS,
  DEFINER_PUBLICAS_OK,
  MODULOS_ESPERADOS,
  ROLES_ESPERADOS,
  TABLAS_NUCLEO,
  TABLAS_SOLO_SERVICE_ROLE,
  TRIGGERS_CRITICOS,
} from "./qa-contract.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARGS = process.argv.slice(2);
const ONLY_JSON = ARGS.includes("--json");
const QUIET = ARGS.includes("--quiet");

// ──────────────────────────────────────────────────────────────────────────
// Motor de banderas
// ──────────────────────────────────────────────────────────────────────────
const checks = [];
let grupoActual = "General";

const grupo = (n) => { grupoActual = n; };
const bandera = (estado, nombre, detalle, extra) =>
  checks.push({ grupo: grupoActual, estado, nombre, detalle, ...(extra ? { datos: extra } : {}) });

const ok = (n, d, e) => bandera("OK", n, d, e);
const aviso = (n, d, e) => bandera("AVISO", n, d, e);
const falla = (n, d, e) => bandera("FALLA", n, d, e);

/** Ejecuta un bloque de checks; si revienta, deja bandera roja en vez de tumbar el QA. */
async function seccion(nombre, fn) {
  grupo(nombre);
  try {
    await fn();
  } catch (e) {
    falla(`${nombre}: error interno`, `El bloque de checks falló: ${e.message}`);
  }
}

const ICONO = { OK: "🟢", AVISO: "🟡", FALLA: "🔴" };

// ──────────────────────────────────────────────────────────────────────────
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ Falta DATABASE_URL en el entorno (.env.local).");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
  statement_timeout: 60_000,
});

const q = async (sql, params) => (await client.query(sql, params)).rows;
const uno = async (sql, params) => (await q(sql, params))[0];

const t0 = Date.now();
let meta = {};

try {
  // ═══════════════════════════════════════════════════════════════════════
  await seccion("Conexión", async () => {
    await client.connect();
    const info = await uno(
      `select current_database() db, version() v,
              pg_size_pretty(pg_database_size(current_database())) tam,
              (select count(*) from pg_stat_activity) conexiones,
              (select setting::int from pg_settings where name='max_connections') max_conn`,
    );
    meta = { ...info };
    ok("Conectividad", `${info.db} · ${info.v.split(",")[0]} · ${info.tam}`);

    const uso = Math.round((Number(info.conexiones) / Number(info.max_conn)) * 100);
    if (uso >= 80) falla("Conexiones", `${info.conexiones}/${info.max_conn} en uso (${uso}%) — riesgo de agotar el pool.`);
    else if (uso >= 60) aviso("Conexiones", `${info.conexiones}/${info.max_conn} en uso (${uso}%).`);
    else ok("Conexiones", `${info.conexiones}/${info.max_conn} en uso (${uso}%).`);
  });

  // ═══════════════════════════════════════════════════════════════════════
  await seccion("Esquema", async () => {
    const tablas = await q(
      `select c.relname tabla, c.relrowsecurity rls,
              (select count(*) from pg_policy p where p.polrelid=c.oid)::int politicas
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r' order by 1`,
    );
    meta.tablas = tablas.length;
    ok("Tablas en `public`", `${tablas.length} tablas.`);

    const faltantes = TABLAS_NUCLEO.filter((t) => !tablas.some((x) => x.tabla === t));
    if (faltantes.length) falla("Tablas núcleo", `Faltan: ${faltantes.join(", ")}`);
    else ok("Tablas núcleo", `Las ${TABLAS_NUCLEO.length} tablas núcleo existen.`);

    const sinPk = await q(
      `select c.relname t from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r'
         and not exists (select 1 from pg_constraint k where k.conrelid=c.oid and k.contype='p')`,
    );
    if (sinPk.length) falla("Claves primarias", `Sin PK: ${sinPk.map((x) => x.t).join(", ")}`);
    else ok("Claves primarias", "Todas las tablas tienen PK.");

    // Enum app_role ↔ src/types/roles.ts
    const enumRol = (await uno(
      `select array_agg(e.enumlabel::text order by e.enumsortorder) v
       from pg_type t join pg_enum e on e.enumtypid=t.oid
       join pg_namespace n on n.oid=t.typnamespace
       where n.nspname='public' and t.typname='app_role'`,
    ))?.v ?? [];
    const soloBd = enumRol.filter((r) => !ROLES_ESPERADOS.includes(r));
    const soloCod = ROLES_ESPERADOS.filter((r) => !enumRol.includes(r));
    if (soloBd.length || soloCod.length) {
      falla("Enum `app_role` ↔ código", `Desincronizado. Solo en BD: [${soloBd}] · solo en código: [${soloCod}]`);
    } else ok("Enum `app_role` ↔ código", `${enumRol.length} roles sincronizados con src/types/roles.ts.`);

    // Vistas sin security_invoker (saltan RLS)
    const vistas = await q(
      `select c.relname v,
              coalesce((select option_value from pg_options_to_table(c.reloptions)
                        where option_name='security_invoker'),'unset') si
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind in ('v','m')`,
    );
    const malas = vistas.filter((v) => v.si !== "true");
    if (!vistas.length) ok("Vistas", "No hay vistas en `public` (nada que pueda saltarse RLS).");
    else if (malas.length) falla("Vistas sin security_invoker", `Saltan RLS: ${malas.map((v) => v.v).join(", ")}`);
    else ok("Vistas", `${vistas.length} vistas, todas con security_invoker.`);

    // Extensiones en public
    const ext = await q(
      `select extname from pg_extension e join pg_namespace n on n.oid=e.extnamespace
       where n.nspname='public'`,
    );
    if (ext.length) aviso("Extensiones en `public`", `Deberían vivir en \`extensions\`: ${ext.map((e) => e.extname).join(", ")}`);
    else ok("Extensiones", "Ninguna extensión instalada en `public`.");
  });

  // ═══════════════════════════════════════════════════════════════════════
  await seccion("Seguridad · RLS", async () => {
    const tablas = await q(
      `select c.relname tabla, c.relrowsecurity rls,
              (select count(*) from pg_policy p where p.polrelid=c.oid)::int politicas,
              (select count(*) from information_schema.role_table_grants g
                where g.table_schema='public' and g.table_name=c.relname
                  and g.grantee in ('anon','authenticated'))::int expuesta
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r' order by 1`,
    );

    const sinRls = tablas.filter((t) => !t.rls);
    if (sinRls.length) {
      falla(
        "RLS habilitada en todas las tablas",
        `${sinRls.length} tabla(s) SIN RLS y accesible(s) por la Data API: ${sinRls.map((t) => t.tabla).join(", ")}`,
        sinRls.map((t) => t.tabla),
      );
    } else ok("RLS habilitada en todas las tablas", `Las ${tablas.length} tablas de \`public\` tienen RLS.`);

    const sinPoliticas = tablas.filter(
      (t) => t.rls && t.politicas === 0 && !TABLAS_SOLO_SERVICE_ROLE.includes(t.tabla),
    );
    if (sinPoliticas.length) {
      aviso(
        "Tablas con RLS pero sin políticas",
        `Nadie (salvo service role) puede leerlas: ${sinPoliticas.map((t) => t.tabla).join(", ")}`,
        sinPoliticas.map((t) => t.tabla),
      );
    } else ok("Tablas con RLS pero sin políticas", "Ninguna tabla queda accidentalmente bloqueada.");

    for (const t of TABLAS_SOLO_SERVICE_ROLE) {
      const row = tablas.find((x) => x.tabla === t);
      if (row && row.rls && row.politicas === 0) ok(`\`${t}\` cerrada`, "RLS activa y 0 políticas: solo service role. Correcto.");
      else falla(`\`${t}\` cerrada`, `Se esperaba RLS activa sin políticas; encontrado rls=${row?.rls} políticas=${row?.politicas}.`);
    }

    // auth.role() está deprecado y se rompe con anonymous sign-ins
    const deprecadas = await q(
      `select n.nspname esq, c.relname tabla, p.polname
       from pg_policy p join pg_class c on c.oid=p.polrelid
       join pg_namespace n on n.oid=c.relnamespace
       where coalesce(pg_get_expr(p.polqual,p.polrelid),'') like '%auth.role()%'
          or coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') like '%auth.role()%'`,
    );
    if (deprecadas.length) {
      aviso(
        "Políticas con `auth.role()` (deprecado)",
        `${deprecadas.length} política(s) lo usan: ${deprecadas.map((d) => `${d.esq}.${d.polname}`).join(", ")}`,
      );
    } else ok("Políticas con `auth.role()`", "Ninguna usa la función deprecada.");

    // UPDATE sin WITH CHECK deja reasignar filas a otro dueño
    const updSinCheck = await q(
      `select c.relname tabla, p.polname from pg_policy p
       join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and p.polcmd='w' and p.polwithcheck is null`,
    );
    if (updSinCheck.length) {
      aviso("Políticas UPDATE sin WITH CHECK", `${updSinCheck.map((x) => `${x.tabla}.${x.polname}`).join(", ")}`);
    } else ok("Políticas UPDATE", "Todas las políticas UPDATE llevan WITH CHECK.");

    // SECURITY DEFINER sin search_path fijo → secuestrable
    const definerSinPath = await q(
      `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.prosecdef
         and (p.proconfig is null or not (p.proconfig::text like '%search_path%'))`,
    );
    if (definerSinPath.length) {
      falla("SECURITY DEFINER sin `search_path`", `Vulnerables a secuestro de esquema: ${definerSinPath.map((f) => f.proname).join(", ")}`);
    } else ok("SECURITY DEFINER con `search_path`", "Todas las funciones definer fijan search_path.");

    // Postgres concede EXECUTE a PUBLIC por defecto, así que toda función
    // SECURITY DEFINER en `public` es invocable por anon vía RPC.
    // Las que devuelven un CONJUNTO de filas son las peligrosas: entregan datos
    // saltándose la RLS de las tablas que consultan. Las escalares/booleanas
    // (is_admin, has_role, can_*) solo informan sobre auth.uid(), que para un
    // anónimo es NULL, y las de trigger no se pueden invocar directamente.
    const definerAnon = await q(
      `select p.proname, p.proretset, t.typname retorno
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       join pg_type t on t.oid=p.prorettype
       where n.nspname='public' and p.prosecdef
         and has_function_privilege('anon', p.oid, 'EXECUTE')`,
    );
    const filtradas = definerAnon.filter((f) => !DEFINER_PUBLICAS_OK.includes(f.proname));
    const exponenDatos = [...new Set(
      filtradas.filter((f) => f.proretset && f.retorno !== "trigger").map((f) => f.proname),
    )];
    const escalares = [...new Set(
      filtradas.filter((f) => !f.proretset && f.retorno !== "trigger").map((f) => f.proname),
    )];

    if (exponenDatos.length) {
      falla(
        "SECURITY DEFINER que devuelven filas a `anon`",
        `RPC público que entrega datos saltándose RLS: ${exponenDatos.join(", ")}. ` +
          `Revoca EXECUTE a anon (y valida auth.uid() dentro de la función).`,
        exponenDatos,
      );
    } else ok("SECURITY DEFINER que devuelven filas a `anon`", "Ninguna función definer devuelve filas a anónimos.");

    if (escalares.length) {
      ok(
        "SECURITY DEFINER escalares públicas",
        `${escalares.length} helpers booleanos/escalares invocables por anon (${escalares.slice(0, 4).join(", ")}…): devuelven false/NULL sin sesión, no filtran datos.`,
      );
    } else ok("SECURITY DEFINER escalares públicas", "Ninguna.");
  });

  // ═══════════════════════════════════════════════════════════════════════
  await seccion("Permisos · Roles y módulos", async () => {
    const huerf = await q(
      `select u.email from auth.users u
       left join public.profiles p on p.id=u.id where p.id is null`,
    );
    if (huerf.length) falla("Usuarios sin perfil", `${huerf.length}: ${huerf.map((u) => u.email).join(", ")}`);
    else ok("Usuarios sin perfil", "Todo usuario de auth tiene fila en `profiles`.");

    const perfHuerf = await q(
      `select p.id, p.email from public.profiles p
       left join auth.users u on u.id=p.id where u.id is null`,
    );
    if (perfHuerf.length) falla("Perfiles huérfanos", `${perfHuerf.length} perfiles sin usuario en auth.`);
    else ok("Perfiles huérfanos", "Ningún perfil sin usuario.");

    const sinRol = await q(
      `select u.email from auth.users u
       left join public.user_roles ur on ur.user_id=u.id where ur.user_id is null`,
    );
    if (sinRol.length) falla("Usuarios sin rol", `${sinRol.length}: ${sinRol.map((u) => u.email).join(", ")}`);
    else ok("Usuarios sin rol", "Todo usuario tiene al menos un rol.");

    // role_key NULL ⇒ can_view_module() nunca acierta ⇒ dashboard vacío
    const sinKey = await q(
      `select u.email, ur.role from public.user_roles ur
       join auth.users u on u.id=ur.user_id where ur.role_key is null order by 1`,
    );
    if (sinKey.length) {
      falla(
        "`user_roles.role_key` poblado",
        `${sinKey.length} usuario(s) con role_key NULL: can_view_module() siempre falla y su dashboard queda vacío. ` +
          sinKey.map((u) => `${u.email} (${u.role})`).join(", "),
        sinKey,
      );
    } else ok("`user_roles.role_key` poblado", "Todos los roles asignados tienen role_key.");

    const keyMala = await q(
      `select distinct ur.role_key from public.user_roles ur
       where ur.role_key is not null
         and not exists (select 1 from public.roles_catalog rc where rc.key=ur.role_key)`,
    );
    if (keyMala.length) falla("`role_key` ↔ `roles_catalog`", `Claves inexistentes: ${keyMala.map((k) => k.role_key).join(", ")}`);
    else ok("`role_key` ↔ `roles_catalog`", "Toda role_key asignada existe en el catálogo.");

    const sinPerms = await q(
      `select rc.key from public.roles_catalog rc
       where not exists (select 1 from public.role_permissions rp where rp.role_key=rc.key)`,
    );
    if (sinPerms.length) aviso("Roles sin permisos", `Sin filas en role_permissions: ${sinPerms.map((r) => r.key).join(", ")}`);
    else ok("Roles sin permisos", "Todo rol del catálogo tiene matriz de permisos.");

    const modulosBd = (await q(`select distinct module m from public.role_permissions`)).map((r) => r.m);
    const modFaltan = MODULOS_ESPERADOS.filter((m) => !modulosBd.includes(m));
    const modSobran = modulosBd.filter((m) => !MODULOS_ESPERADOS.includes(m));
    if (modFaltan.length) falla("Módulos ↔ `role_permissions`", `Módulos de la app sin permisos en BD: ${modFaltan.join(", ")}`);
    else if (modSobran.length) aviso("Módulos ↔ `role_permissions`", `Módulos en BD que la app no conoce: ${modSobran.join(", ")}`);
    else ok("Módulos ↔ `role_permissions`", `Los ${MODULOS_ESPERADOS.length} módulos coinciden con src/types/roles.ts.`);

    const catalogo = await q(`select key from public.roles_catalog order by 1`);
    const enumFaltan = ROLES_ESPERADOS.filter((r) => !catalogo.some((c) => c.key === r));
    if (enumFaltan.length) aviso("`roles_catalog` completo", `Roles base sin entrada en el catálogo: ${enumFaltan.join(", ")}`);
    else ok("`roles_catalog` completo", `${catalogo.length} roles en el catálogo.`);
  });

  // ═══════════════════════════════════════════════════════════════════════
  await seccion("Permisos · Simulación por usuario (RLS real)", async () => {
    const usuarios = await q(
      `select u.id, u.email, ur.role, ur.role_key
       from auth.users u join public.user_roles ur on ur.user_id=u.id order by u.email`,
    );
    const vacios = [];
    const fugas = [];

    for (const u of usuarios) {
      await client.query("begin");
      try {
        await client.query(
          `select set_config('request.jwt.claims',
             json_build_object('sub',$1::text,'role','authenticated')::text, true)`,
          [u.id],
        );
        await client.query("set local role authenticated");

        const mods = (await uno(
          `select count(*)::int n from public.user_roles ur
           join public.role_permissions rp on rp.role_key=ur.role_key
           where ur.user_id=auth.uid() and rp.can_view`,
        )).n;
        const esAdmin = (await uno("select public.is_admin() a")).a;
        if (mods === 0 && !esAdmin) vacios.push(`${u.email} (${u.role})`);

        // Ningún usuario final debe poder leer los secretos de integraciones
        const secretos = (await uno("select count(*)::int n from public.app_secrets")).n;
        if (secretos > 0) fugas.push(`${u.email} lee app_secrets (${secretos} filas)`);
      } finally {
        await client.query("rollback");
      }
    }

    meta.usuarios = usuarios.length;
    if (vacios.length) {
      falla(
        "Cada usuario ve al menos un módulo",
        `${vacios.length} usuario(s) entran a un dashboard vacío: ${vacios.join(", ")}`,
        vacios,
      );
    } else ok("Cada usuario ve al menos un módulo", `Los ${usuarios.length} usuarios tienen módulos visibles.`);

    if (fugas.length) falla("`app_secrets` inaccesible para usuarios", fugas.join(" · "));
    else ok("`app_secrets` inaccesible para usuarios", `Ninguno de los ${usuarios.length} usuarios puede leer los secretos.`);

    // Un anónimo no debe leer nada sensible
    await client.query("begin");
    try {
      await client.query(
        `select set_config('request.jwt.claims', json_build_object('role','anon')::text, true)`,
      );
      await client.query("set local role anon");
      const anon = {};
      for (const t of ["citizens", "contacts", "requests", "profiles", "documents", "tasks", "settings"]) {
        try { anon[t] = (await uno(`select count(*)::int n from public.${t}`)).n; }
        catch { anon[t] = "denegado"; }
      }
      const leidas = Object.entries(anon).filter(([, n]) => typeof n === "number" && n > 0);
      // `settings` expone a propósito perfil_publico/contacto para la landing.
      const graves = leidas.filter(([t]) => t !== "settings");
      if (graves.length) falla("Anónimo no lee datos internos", `anon lee: ${graves.map(([t, n]) => `${t}=${n}`).join(", ")}`);
      else ok("Anónimo no lee datos internos", `anon solo ve lo público (settings=${anon.settings}).`);
    } finally {
      await client.query("rollback");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  await seccion("Integridad de datos", async () => {
    // Recorre TODAS las FK y busca hijos apuntando a padres inexistentes.
    const fks = await q(
      `select ct.conname, ct.conrelid::regclass::text hijo, ct.confrelid::regclass::text padre,
              (select string_agg(quote_ident(a.attname),',' order by x.ord)
                 from unnest(ct.conkey) with ordinality x(attnum,ord)
                 join pg_attribute a on a.attrelid=ct.conrelid and a.attnum=x.attnum) cols_hijo,
              (select string_agg(quote_ident(a.attname),',' order by x.ord)
                 from unnest(ct.confkey) with ordinality x(attnum,ord)
                 join pg_attribute a on a.attrelid=ct.confrelid and a.attnum=x.attnum) cols_padre
       from pg_constraint ct
       where ct.contype='f' and ct.connamespace='public'::regnamespace
         and array_length(ct.conkey,1)=1`,
    );
    const rotas = [];
    for (const fk of fks) {
      const n = (await uno(
        `select count(*)::int n from ${fk.hijo} h
         where h.${fk.cols_hijo} is not null
           and not exists (select 1 from ${fk.padre} p where p.${fk.cols_padre} = h.${fk.cols_hijo})`,
      )).n;
      if (n > 0) rotas.push(`${fk.hijo}.${fk.cols_hijo} → ${n} huérfanos`);
    }
    meta.fks = fks.length;
    if (rotas.length) falla("Referencias huérfanas", rotas.join(" · "));
    else ok("Referencias huérfanas", `Las ${fks.length} claves foráneas apuntan a filas existentes.`);

    const sinRad = (await uno(
      `select count(*)::int n from public.requests where radicado is null or radicado=''`,
    )).n;
    if (sinRad > 0) falla("Radicado de solicitudes", `${sinRad} solicitud(es) sin radicado — el trigger no está actuando.`);
    else ok("Radicado de solicitudes", "Toda solicitud tiene radicado.");

    const radDup = await q(
      `select radicado, count(*) n from public.requests
       where radicado is not null group by 1 having count(*)>1`,
    );
    if (radDup.length) falla("Radicados duplicados", radDup.map((r) => `${r.radicado} ×${r.n}`).join(", "));
    else ok("Radicados duplicados", "Todos los radicados son únicos.");

    const emailDup = await q(
      `select lower(email) e, count(*) n from public.profiles
       where email is not null group by 1 having count(*)>1`,
    );
    if (emailDup.length) aviso("Correos duplicados en perfiles", emailDup.map((r) => `${r.e} ×${r.n}`).join(", "));
    else ok("Correos duplicados en perfiles", "Sin correos repetidos.");

    const trigs = await q(
      `select n.nspname esq, c.relname tabla, t.tgname, t.tgenabled
       from pg_trigger t join pg_class c on c.oid=t.tgrelid
       join pg_namespace n on n.oid=c.relnamespace
       where not t.tgisinternal`,
    );
    const trigFaltan = TRIGGERS_CRITICOS.filter(
      ([tabla, nom, esq]) => !trigs.some((t) => t.tabla === tabla && t.tgname === nom && t.esq === esq && t.tgenabled === "O"),
    );
    if (trigFaltan.length) {
      falla("Triggers críticos", `Ausentes o deshabilitados: ${trigFaltan.map(([t, n]) => `${t}.${n}`).join(", ")}`);
    } else ok("Triggers críticos", `Los ${TRIGGERS_CRITICOS.length} triggers clave están activos.`);

    const trigOff = trigs.filter((t) => t.tgenabled !== "O");
    if (trigOff.length) aviso("Triggers deshabilitados", trigOff.map((t) => `${t.tabla}.${t.tgname}`).join(", "));
    else ok("Triggers deshabilitados", `Los ${trigs.length} triggers de usuario están habilitados.`);

    const softDel = await q(
      `select 'tasks' t, count(*)::int n from public.tasks where deleted_at is not null
       union all select 'requests', count(*)::int from public.requests where deleted_at is not null
       union all select 'documents', count(*)::int from public.documents where deleted_at is not null`,
    );
    ok("Borrado lógico", softDel.map((r) => `${r.t}=${r.n}`).join(" · ") + " filas archivadas.");
  });

  // ═══════════════════════════════════════════════════════════════════════
  await seccion("Storage", async () => {
    const buckets = await q(`select id, public from storage.buckets order by 1`);
    const faltan = Object.keys(BUCKETS_ESPERADOS).filter((b) => !buckets.some((x) => x.id === b));
    if (faltan.length) falla("Buckets esperados", `Faltan: ${faltan.join(", ")}`);
    else ok("Buckets esperados", `Los ${Object.keys(BUCKETS_ESPERADOS).length} buckets existen.`);

    const visMal = buckets
      .filter((b) => BUCKETS_ESPERADOS[b.id] && BUCKETS_ESPERADOS[b.id].publico !== b.public)
      .map((b) => `${b.id} es ${b.public ? "público" : "privado"} y se esperaba lo contrario`);
    if (visMal.length) falla("Visibilidad de buckets", visMal.join(" · "));
    else ok("Visibilidad de buckets", "Privados: " + Object.entries(BUCKETS_ESPERADOS).filter(([, v]) => !v.publico).map(([k]) => k).join(", ") + ".");

    const extra = buckets.filter((b) => !BUCKETS_ESPERADOS[b.id]);
    if (extra.length) aviso("Buckets no declarados", `Existen pero el QA no los conoce: ${extra.map((b) => b.id).join(", ")}`);
    else ok("Buckets no declarados", "No hay buckets sobrantes.");

    // Políticas de storage que apuntan a buckets inexistentes = basura heredada
    const pols = await q(
      `select p.polname,
              coalesce(pg_get_expr(p.polqual,p.polrelid),'') || ' ' ||
              coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') expr
       from pg_policy p join pg_class c on c.oid=p.polrelid
       join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='storage' and c.relname='objects'`,
    );
    const ids = new Set(buckets.map((b) => b.id));
    const fantasma = pols.filter((p) => {
      const m = [...p.expr.matchAll(/bucket_id\s*=\s*'([^']+)'/g)].map((x) => x[1]);
      return m.length > 0 && m.every((b) => !ids.has(b));
    });
    if (fantasma.length) {
      aviso(
        "Políticas de storage huérfanas",
        `${fantasma.length} política(s) apuntan a buckets que no existen (basura de otro proyecto; concederían acceso amplio si alguien crea un bucket con ese nombre): ${fantasma.map((p) => p.polname).join(", ")}`,
        fantasma.map((p) => p.polname),
      );
    } else ok("Políticas de storage huérfanas", "Todas las políticas apuntan a buckets existentes.");

    // Filas de BD que apuntan a un archivo que ya no está en el bucket
    const refs = [
      ["documents", "storage_path", "documentos"],
      ["contact_documents", "storage_path", "contact-files"],
      ["task_attachments", "storage_path", "task-files"],
      ["cobertura_files", "storage_path", "coberturas"],
    ];
    const rotos = [];
    for (const [tabla, col, bucket] of refs) {
      const n = (await uno(
        `select count(*)::int n from public.${tabla} t
         where t.${col} is not null and t.${col} <> ''
           and not exists (select 1 from storage.objects o where o.bucket_id=$1 and o.name=t.${col})`,
        [bucket],
      )).n;
      if (n > 0) rotos.push(`${tabla}: ${n} sin archivo en ${bucket}`);
    }
    if (rotos.length) aviso("Referencias a archivos inexistentes", rotos.join(" · "));
    else ok("Referencias a archivos inexistentes", "Toda fila con storage_path tiene su archivo.");

    const objetos = await q(`select bucket_id, count(*)::int n from storage.objects group by 1 order by 1`);
    ok("Objetos almacenados", objetos.length ? objetos.map((o) => `${o.bucket_id}=${o.n}`).join(" · ") : "Sin archivos.");
  });

  // ═══════════════════════════════════════════════════════════════════════
  await seccion("Operación", async () => {
    const secretos = await q(`select key from public.app_secrets order by 1`);
    const esperados = ["google_drive"];
    const falt = esperados.filter((k) => !secretos.some((s) => s.key === k));
    if (falt.length) aviso("Secretos de integración", `Sin configurar: ${falt.join(", ")}`);
    else ok("Secretos de integración", `${secretos.length} configurados: ${secretos.map((s) => s.key).join(", ")}`);

    const ajustes = await q(`select key from public.settings order by 1`);
    const ajFalt = ["perfil_publico", "contacto"].filter((k) => !ajustes.some((a) => a.key === k));
    if (ajFalt.length) aviso("Ajustes públicos", `Faltan claves que usa la landing: ${ajFalt.join(", ")}`);
    else ok("Ajustes públicos", `${ajustes.length} claves en \`settings\`.`);

    const lt = (await uno(`select count(*)::int n from public.linktree_config`)).n;
    if (lt === 0) aviso("Mis Redes (linktree)", "Sin configuración: la página pública saldrá vacía.");
    else ok("Mis Redes (linktree)", `Configuración presente (${lt} fila).`);

    // El cron de vencimientos solo debe poder llamarlo el service role
    const job = await uno(
      `select has_function_privilege('anon', p.oid,'EXECUTE') a,
              has_function_privilege('authenticated', p.oid,'EXECUTE') u
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='notify_due_tasks'`,
    );
    if (!job) falla("Job `notify_due_tasks`", "La función del cron de vencimientos no existe.");
    else if (job.a || job.u) falla("Job `notify_due_tasks`", "Ejecutable por anon/authenticated; debe ser exclusivo del service role.");
    else ok("Job `notify_due_tasks`", "Existe y solo la puede ejecutar el service role (cron).");

    const notif = await q(
      `select canal, estado_envio, count(*)::int n from public.notifications group by 1,2`,
    );
    const fallidas = notif.filter((x) => x.estado_envio === "error").reduce((a, b) => a + b.n, 0);
    if (fallidas > 0) aviso("Notificaciones", `${fallidas} con estado de envío en error.`);
    else ok("Notificaciones", notif.length ? notif.map((x) => `${x.canal}/${x.estado_envio}=${x.n}`).join(" · ") : "Sin notificaciones.");

    const ultAudit = (await uno(`select max(created_at) m from public.audit_logs`)).m;
    const ultAct = (await uno(`select max(created_at) m from public.activity_log`)).m;
    ok("Trazabilidad", `Última auditoría: ${ultAudit ? new Date(ultAudit).toISOString().slice(0, 16).replace("T", " ") : "—"} · última actividad: ${ultAct ? new Date(ultAct).toISOString().slice(0, 16).replace("T", " ") : "—"}`);

    const conteos = await q(
      `select 'ciudadanos' t, count(*)::int n from public.citizens
       union all select 'contactos', count(*)::int from public.contacts
       union all select 'solicitudes', count(*)::int from public.requests
       union all select 'tareas', count(*)::int from public.tasks
       union all select 'eventos', count(*)::int from public.events
       union all select 'zonas', count(*)::int from public.zones
       union all select 'documentos', count(*)::int from public.documents
       union all select 'contenido', count(*)::int from public.content_posts
       union all select 'monitoreo', count(*)::int from public.monitor_items
       union all select 'conocimiento', count(*)::int from public.kb_documents
       order by 1`,
    );
    meta.conteos = Object.fromEntries(conteos.map((c) => [c.t, c.n]));
    ok("Volumen de datos", conteos.map((c) => `${c.t}=${c.n}`).join(" · "));
  });

  // ═══════════════════════════════════════════════════════════════════════
  await seccion("Rendimiento", async () => {
    const fkSinIdx = await q(
      `select ct.conrelid::regclass::text tabla, ct.conname
       from pg_constraint ct
       where ct.contype='f' and ct.connamespace='public'::regnamespace
         and not exists (
           select 1 from pg_index i where i.indrelid=ct.conrelid
             and (i.indkey::int2[])[0:array_length(ct.conkey,1)-1] @> ct.conkey
             and ct.conkey @> (i.indkey::int2[])[0:array_length(ct.conkey,1)-1])
       order by 1`,
    );
    if (fkSinIdx.length > 0) {
      aviso(
        "Claves foráneas sin índice",
        `${fkSinIdx.length} FK sin índice de respaldo — los borrados en cascada y los JOIN escanean la tabla entera. Irrelevante con el volumen actual; revísalo antes de crecer.`,
        fkSinIdx.map((f) => `${f.tabla}.${f.conname}`),
      );
    } else ok("Claves foráneas sin índice", "Todas las FK tienen índice.");

    const dup = await q(
      `select indrelid::regclass::text tabla, count(*)::int n,
              string_agg(indexrelid::regclass::text, ', ') indices
       from pg_index i join pg_class c on c.oid=i.indrelid
       join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public'
       group by indrelid, indkey having count(*)>1`,
    );
    if (dup.length) aviso("Índices duplicados", dup.map((d) => `${d.tabla}: ${d.indices}`).join(" · "));
    else ok("Índices duplicados", "Sin índices redundantes.");

    const sinAnalizar = await q(
      `select relname from pg_stat_user_tables
       where schemaname='public' and last_analyze is null and last_autoanalyze is null
         and n_live_tup > 500`,
    );
    if (sinAnalizar.length) aviso("Estadísticas del planificador", `Tablas grandes sin ANALYZE: ${sinAnalizar.map((t) => t.relname).join(", ")}`);
    else ok("Estadísticas del planificador", "Las tablas con volumen tienen estadísticas.");

    const bloat = await q(
      `select relname, n_dead_tup::int d, n_live_tup::int l from pg_stat_user_tables
       where schemaname='public' and n_dead_tup > 1000 and n_dead_tup > n_live_tup * 0.2`,
    );
    if (bloat.length) aviso("Filas muertas", bloat.map((b) => `${b.relname}: ${b.d} muertas / ${b.l} vivas`).join(" · "));
    else ok("Filas muertas", "Sin acumulación relevante (autovacuum al día).");
  });
} catch (e) {
  falla("QA abortado", e.message);
} finally {
  await client.end().catch(() => {});
}

// ══════════════════════════════════════════════════════════════════════════
// Reporte
// ══════════════════════════════════════════════════════════════════════════
const resumen = {
  ok: checks.filter((c) => c.estado === "OK").length,
  aviso: checks.filter((c) => c.estado === "AVISO").length,
  falla: checks.filter((c) => c.estado === "FALLA").length,
};
const semaforo = resumen.falla > 0 ? "🔴 ROJO" : resumen.aviso > 0 ? "🟡 AMARILLO" : "🟢 VERDE";
const generado = new Date().toISOString();
const duracion = ((Date.now() - t0) / 1000).toFixed(1);

const reporte = { generado, duracion_s: Number(duracion), semaforo, resumen, meta, checks };

if (ONLY_JSON) {
  console.log(JSON.stringify(reporte, null, 2));
} else {
  console.log(`\n╔═══════════════════════════════════════════════════════════════════════╗`);
  console.log(`║  UTL 360 · QA de base de datos                                        ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════════════╝`);
  let g = null;
  for (const c of checks) {
    if (QUIET && c.estado === "OK") continue;
    if (c.grupo !== g) { g = c.grupo; console.log(`\n── ${g} ${"─".repeat(Math.max(0, 66 - g.length))}`); }
    console.log(`${ICONO[c.estado]} ${c.nombre}`);
    console.log(`   ${c.detalle}`);
  }
  console.log(`\n${"═".repeat(73)}`);
  console.log(`SEMÁFORO: ${semaforo}   ·   🟢 ${resumen.ok}   🟡 ${resumen.aviso}   🔴 ${resumen.falla}   ·   ${duracion}s`);
  console.log(`${"═".repeat(73)}\n`);
}

// Persiste el reporte para poder comparar corridas y revisarlo fuera de consola.
try {
  const dir = join(ROOT, "docs", "qa");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "db-qa-latest.json"), JSON.stringify(reporte, null, 2), "utf8");

  const md = [
    `# QA de base de datos · UTL 360`,
    ``,
    `**Semáforo: ${semaforo}** — 🟢 ${resumen.ok} correctas · 🟡 ${resumen.aviso} avisos · 🔴 ${resumen.falla} fallas`,
    ``,
    `Generado: ${generado} · ${duracion}s · ${meta.tablas ?? "?"} tablas · ${meta.usuarios ?? "?"} usuarios · ${meta.tam ?? "?"}`,
    ``,
    `> Regenerar con \`npm run qa:db\`.`,
    ``,
    ...["FALLA", "AVISO", "OK"].flatMap((estado) => {
      const items = checks.filter((c) => c.estado === estado);
      if (!items.length) return [];
      return [
        `## ${ICONO[estado]} ${estado === "FALLA" ? "Fallas" : estado === "AVISO" ? "Avisos" : "Correctas"} (${items.length})`,
        ``,
        `| Grupo | Check | Detalle |`,
        `| --- | --- | --- |`,
        ...items.map((c) => `| ${c.grupo} | ${c.nombre} | ${String(c.detalle).replace(/\|/g, "\\|")} |`),
        ``,
      ];
    }),
  ].join("\n");
  writeFileSync(join(dir, "db-qa-latest.md"), md, "utf8");
  if (!ONLY_JSON) console.log(`Reporte guardado en docs/qa/db-qa-latest.md y .json\n`);
} catch (e) {
  if (!ONLY_JSON) console.error(`⚠ No se pudo guardar el reporte: ${e.message}`);
}

process.exit(resumen.falla > 0 ? 1 : 0);
