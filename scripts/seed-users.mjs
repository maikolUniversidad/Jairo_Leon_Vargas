// ============================================================================
// UTL 360 · Crea usuarios demo en Supabase Auth y les asigna roles.
//
// Requisitos:
//   1) Proyecto Supabase creado y migraciones 0001–0004 ejecutadas.
//   2) .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY reales.
//
// Uso (Node 20+):
//   node --env-file=.env.local scripts/seed-users.mjs
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

const USERS = [
  { email: "admin@utl360.local",          password: "Admin#2026",        full_name: "Administrador General", role: "super_admin" },
  { email: "coordinacion@utl360.local",   password: "Coord#2026",        full_name: "Coordinación UTL",      role: "coordinador_utl" },
  { email: "atencion@utl360.local",       password: "Atencion#2026",     full_name: "Atención Ciudadana",    role: "atencion_ciudadana" },
  { email: "territorio@utl360.local",     password: "Territorio#2026",   full_name: "Coordinación Territorial", role: "coordinador_territorial" },
  { email: "comunicaciones@utl360.local", password: "Comms#2026",        full_name: "Comunicaciones",        role: "comunicaciones" },
];

for (const u of USERS) {
  // 1) Crear usuario (o recuperarlo si ya existe)
  let userId;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { full_name: u.full_name },
  });

  if (createErr) {
    if (/already.*registered|exists/i.test(createErr.message)) {
      const { data: list } = await admin.auth.admin.listUsers();
      userId = list.users.find((x) => x.email === u.email)?.id;
      console.log(`• ${u.email} ya existía.`);
    } else {
      console.error(`✖ ${u.email}: ${createErr.message}`);
      continue;
    }
  } else {
    userId = created.user.id;
    console.log(`✓ Creado ${u.email}`);
  }

  if (!userId) continue;

  // 2) Asignar rol (el trigger crea profile + rol 'consulta'; lo elevamos)
  await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "consulta");
  await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: u.role }, { onConflict: "user_id,role" });

  // 3) Asegurar perfil con nombre
  await admin
    .from("profiles")
    .update({ full_name: u.full_name })
    .eq("id", userId);

  console.log(`  → rol: ${u.role}`);
}

console.log("\nListo. Usuarios demo creados. Inicia sesión en /login.");
