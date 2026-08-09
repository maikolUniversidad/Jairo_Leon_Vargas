// ============================================================================
// UTL 360 · Preflight: la única puerta antes de producción.
//
// Uso:
//   npm run preflight              → todo (tipos, lint, pruebas, BD, build)
//   npm run preflight -- --rapido  → sin build (para revisar mientras trabajas)
//   npm run preflight -- --sin-bd  → sin QA de base de datos (sin conexión)
//
// Cada etapa deja bandera: 🟢 pasó · 🔴 falló.
// Sale con código 1 si alguna falla → sirve como gate en CI o en un hook de git.
// ============================================================================
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARGS = process.argv.slice(2);
const RAPIDO = ARGS.includes("--rapido");
const SIN_BD = ARGS.includes("--sin-bd");

const ETAPAS = [
  {
    id: "tipos",
    titulo: "Tipos (tsc --noEmit)",
    porque: "Un error de tipos es un error en producción que todavía no ha pasado.",
    cmd: "npm",
    args: ["run", "--silent", "typecheck"],
  },
  {
    id: "lint",
    titulo: "Lint (next lint)",
    porque: "Reglas de React/Next que rompen el render o el build.",
    cmd: "npm",
    args: ["run", "--silent", "lint"],
  },
  {
    id: "pruebas",
    titulo: "Pruebas unitarias y de contrato (vitest)",
    porque: "Lógica de negocio pura y sincronía entre el código y el contrato de la BD.",
    cmd: "npx",
    args: ["vitest", "run", "--reporter=dot"],
  },
  {
    id: "bd",
    titulo: "QA de base de datos (db-qa)",
    porque: "RLS, permisos por rol, integridad referencial y storage contra la BD real.",
    cmd: "node",
    args: ["--env-file=.env.local", "scripts/db-qa.mjs", "--quiet"],
    saltar: SIN_BD,
    motivoSalto: "--sin-bd",
  },
  {
    id: "build",
    titulo: "Build de producción (next build)",
    porque: "Lo que compila en tu máquina es lo que se despliega.",
    cmd: "npm",
    args: ["run", "--silent", "build"],
    saltar: RAPIDO,
    motivoSalto: "--rapido",
  },
];

console.log("\n╔═══════════════════════════════════════════════════════════════════════╗");
console.log("║  UTL 360 · Preflight — comprobaciones antes de producción             ║");
console.log("╚═══════════════════════════════════════════════════════════════════════╝\n");

const resultados = [];
const t0 = Date.now();

for (const etapa of ETAPAS) {
  if (etapa.saltar) {
    console.log(`⏭  ${etapa.titulo} — omitida (${etapa.motivoSalto})\n`);
    resultados.push({ ...etapa, estado: "OMITIDA", segundos: 0 });
    continue;
  }

  console.log(`▶  ${etapa.titulo}`);
  const t = Date.now();
  const r = spawnSync(etapa.cmd, etapa.args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const segundos = Number(((Date.now() - t) / 1000).toFixed(1));
  const estado = r.status === 0 ? "OK" : "FALLA";
  console.log(`${estado === "OK" ? "🟢" : "🔴"} ${etapa.titulo} · ${segundos}s\n`);
  resultados.push({ ...etapa, estado, segundos });

  // Si fallan los tipos, el lint o las pruebas, seguir es perder tiempo.
  if (estado === "FALLA" && ["tipos", "lint", "pruebas"].includes(etapa.id)) {
    console.log("⛔ Se corta aquí: arregla esto antes de seguir.\n");
    break;
  }
}

const fallidas = resultados.filter((r) => r.estado === "FALLA");
const omitidas = resultados.filter((r) => r.estado === "OMITIDA");
const pendientes = ETAPAS.filter((e) => !resultados.some((r) => r.id === e.id));
const total = ((Date.now() - t0) / 1000).toFixed(1);

console.log("═".repeat(73));
for (const r of resultados) {
  const icono = r.estado === "OK" ? "🟢" : r.estado === "FALLA" ? "🔴" : "⏭ ";
  console.log(`${icono} ${r.titulo.padEnd(48)} ${r.estado}`);
}
for (const e of pendientes) console.log(`   ${e.titulo.padEnd(48)} NO EJECUTADA`);
console.log("═".repeat(73));

if (fallidas.length === 0 && pendientes.length === 0 && omitidas.length === 0) {
  console.log(`\n🟢 TODO EN VERDE — listo para producción. (${total}s)\n`);
} else if (fallidas.length === 0) {
  const nombres = [...omitidas, ...pendientes].map((r) => r.titulo).join(", ");
  console.log(`\n🟡 SIN FALLAS, pero quedaron etapas fuera: ${nombres}. (${total}s)`);
  console.log("   No lo tomes como luz verde hasta correr el preflight completo.\n");
} else {
  console.log(`\n🔴 NO DESPLEGAR — ${fallidas.length} etapa(s) en falla: ${fallidas.map((r) => r.titulo).join(", ")}. (${total}s)\n`);
}

try {
  const dir = join(ROOT, "docs", "qa");
  mkdirSync(dir, { recursive: true });
  const md = [
    "# Preflight · UTL 360",
    "",
    `Ejecutado: ${new Date().toISOString()} · ${total}s`,
    "",
    `**Resultado: ${fallidas.length ? "🔴 NO DESPLEGAR" : pendientes.length || omitidas.length ? "🟡 INCOMPLETO" : "🟢 LISTO"}**`,
    "",
    "| Etapa | Resultado | Tiempo | Qué cubre |",
    "| --- | --- | --- | --- |",
    ...ETAPAS.map((e) => {
      const r = resultados.find((x) => x.id === e.id);
      const estado = !r ? "— no ejecutada" : r.estado === "OK" ? "🟢 OK" : r.estado === "FALLA" ? "🔴 FALLA" : "⏭ omitida";
      return `| ${e.titulo} | ${estado} | ${r?.segundos ?? 0}s | ${e.porque} |`;
    }),
    "",
    "> Regenerar con `npm run preflight`. El detalle del QA de base de datos está en `db-qa-latest.md`.",
    "",
  ].join("\n");
  writeFileSync(join(dir, "preflight-latest.md"), md, "utf8");
  console.log("Reporte guardado en docs/qa/preflight-latest.md\n");
} catch (e) {
  console.error(`⚠ No se pudo guardar el reporte: ${e.message}`);
}

process.exit(fallidas.length > 0 ? 1 : 0);
