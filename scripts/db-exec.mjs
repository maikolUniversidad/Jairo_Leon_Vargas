// ============================================================================
// UTL 360 · Ejecuta archivos .sql contra Postgres de Supabase.
// Uso: node --env-file=.env.local scripts/db-exec.mjs <archivo.sql> [otro.sql ...]
// Requiere DATABASE_URL en el entorno.
// ============================================================================
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✖ Falta DATABASE_URL en .env.local");
  process.exit(1);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("✖ Indica al menos un archivo .sql");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
});

try {
  await client.connect();
  console.log("✓ Conectado a la base de datos.");
  for (const file of files) {
    const sql = readFileSync(file, "utf8");
    process.stdout.write(`→ Ejecutando ${file} ... `);
    await client.query(sql);
    console.log("OK");
  }
  console.log("\n✓ Todas las migraciones se aplicaron correctamente.");
} catch (err) {
  console.error("\n✖ Error:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
