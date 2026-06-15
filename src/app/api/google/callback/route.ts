import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { handleOAuthCallback } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const base = "/dashboard/configuracion";
  if (!code) {
    return NextResponse.redirect(new URL(`${base}?google=error`, req.url));
  }

  try {
    const redirectUri = new URL("/api/google/callback", req.nextUrl.origin).toString();
    await handleOAuthCallback(code, redirectUri);
    return NextResponse.redirect(new URL(`${base}?google=connected`, req.url));
  } catch {
    return NextResponse.redirect(new URL(`${base}?google=error`, req.url));
  }
}
