// ============================================================================
// UTL 360 · Crea usuarios demo en Supabase Auth y les asigna rol + área.
//
// Requisitos:
//   1) Proyecto Supabase creado y migraciones 0001–0004 ejecutadas.
//   2) .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY reales.
//
// Uso (Node 20+):
//   node --env-file=.env.local scripts/seed-users.mjs
//
// Idempotente: si el usuario ya existe lo reutiliza y re-sincroniza
// contraseña, nombre, rol y área. Contraseña común para todos: Utl360*demo
//
// ⚠️ Usa la SERVICE ROLE KEY (solo local/servidor). No la subas a git.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey || url.includes("placeholder")) {
  console.error(
    "✖ Falta configurar Supabase real en .env.local (URL + SERVICE_ROLE_KEY).",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Contraseña común para todos los usuarios de prueba.
const PASSWORD = "Utl360*demo";

// Usuarios de prueba: nombres realistas (Colombia), uno por rol de la UTL.
const USERS = [
  { email: "carolina.restrepo@utl360.local", full_name: "Carolina Restrepo Gómez",   phone: "+57 310 555 0101", role: "super_admin",             area: "Dirección General" },
  { email: "andres.moreno@utl360.local",     full_name: "Andrés Felipe Moreno Díaz", phone: "+57 310 555 0102", role: "administrador",           area: "Coordinación UTL" },
  { email: "marta.ospina@utl360.local",      full_name: "Marta Lucía Ospina Rivera", phone: "+57 310 555 0103", role: "direccion_general",       area: "Dirección General" },
  { email: "diego.castano@utl360.local",     full_name: "Diego Fernando Castaño",    phone: "+57 310 555 0104", role: "coordinador_utl",         area: "Coordinación UTL" },
  { email: "valentina.rios@utl360.local",    full_name: "Valentina Ríos Pardo",      phone: "+57 310 555 0105", role: "juridico_legislativo",    area: "Jurídico / Legislativo" },
  { email: "sebastian.mejia@utl360.local",   full_name: "Sebastián Mejía Torres",    phone: "+57 310 555 0106", role: "comunicaciones",          area: "Comunicaciones" },
  { email: "laura.beltran@utl360.local",     full_name: "Laura Camila Beltrán",      phone: "+57 310 555 0107", role: "coordinador_territorial", area: "Territorial" },
  { email: "jhon.quintero@utl360.local",     full_name: "Jhon Jairo Quintero",       phone: "+57 310 555 0108", role: "gestor_territorial",      area: "Territorial" },
  { email: "yuli.ramirez@utl360.local",      full_name: "Yuli Andrea Ramírez",       phone: "+57 310 555 0109", role: "atencion_ciudadana",      area: "Atención Ciudadana" },
  { email: "camilo.ardila@utl360.local",     full_name: "Camilo Ardila Sánchez",     phone: "+57 310 555 0110", role: "analitica_reportes",      area: "Analítica" },
  { email: "tatiana.gomez@utl360.local",     full_name: "Tatiana Gómez Ruiz",        phone: "+57 310 555 0111", role: "voluntario",              area: "Territorial" },
  { email: "oscar.patino@utl360.local",      full_name: "Óscar Daniel Patiño",       phone: "+57 310 555 0112", role: "consulta",                area: null },
];

// Busca un usuario por email recorriendo las páginas de Auth.
async function findUserByEmail(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

// Mapa nombre de área -> id
const { data: areas, error: areasErr } = await admin.from("areas").select("id, nombre");
if (areasErr) {
  console.error("✖ No se pudieron leer las áreas:", areasErr.message);
  process.exit(1);
}
const areaId = new Map(areas.map((a) => [a.nombre, a.id]));

let creados = 0;
let reusados = 0;

for (const u of USERS) {
  // 1) Crear usuario (o recuperarlo si ya existe)
  let userId;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.full_name },
  });

  if (createErr) {
    const existing = await findUserByEmail(u.email);
    if (!existing) {
      console.error(`✖ ${u.email}: ${createErr.message}`);
      continue;
    }
    userId = existing.id;
    // Re-asegura contraseña conocida y nombre en usuarios ya existentes.
    await admin.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      user_metadata: { full_name: u.full_name },
    });
    reusados += 1;
  } else {
    userId = created.user.id;
    creados += 1;
  }

  // 2) Sincroniza el profile (el trigger ya lo creó con full_name/email).
  await admin
    .from("profiles")
    .update({
      full_name: u.full_name,
      phone: u.phone,
      area_id: u.area ? areaId.get(u.area) ?? null : null,
      is_active: true,
    })
    .eq("id", userId);

  // 3) Deja exactamente el rol deseado (elimina el 'consulta' por defecto del trigger).
  await admin.from("user_roles").delete().eq("user_id", userId);
  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: u.role });
  if (roleErr) console.error(`  · rol ${u.role} para ${u.email}: ${roleErr.message}`);

  console.log(`✓ ${u.full_name.padEnd(26)} ${u.email.padEnd(32)} [${u.role}]`);
}

console.log(`\n✓ Listo. ${creados} creados, ${reusados} actualizados.`);
console.log(`  Contraseña para todos: ${PASSWORD}`);
console.log("  Inicia sesión en /login.");
