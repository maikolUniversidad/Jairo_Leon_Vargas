import { readFileSync } from "node:fs";
import path from "node:path";

import { LOGO_JAIRO, LOGO_PACTO, COVERS } from "./assets";

export const dynamic = "force-dynamic";

let cached: string | null = null;

/** Construye el HTML final: plantilla + claves públicas de Supabase + recursos de marca. */
function buildHtml(): string {
  if (cached) return cached;
  const tpl = readFileSync(
    path.join(process.cwd(), "src", "app", "misredes", "misredes.html"),
    "utf8",
  );
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  cached = tpl
    .replace(/__SUPA_URL__/g, () => supaUrl)
    .replace(/__SUPA_KEY__/g, () => supaKey)
    .replace(/"__LOGO_JAIRO__"/, () => JSON.stringify(LOGO_JAIRO))
    .replace(/"__LOGO_PACTO__"/, () => JSON.stringify(LOGO_PACTO))
    .replace(/__COVERS__/, () => JSON.stringify(COVERS));
  return cached;
}

export async function GET() {
  return new Response(buildHtml(), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
