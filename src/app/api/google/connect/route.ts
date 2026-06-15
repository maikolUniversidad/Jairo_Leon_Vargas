import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/dashboard/configuracion?google=missing_env", req.url));
  }
  const redirectUri = new URL("/api/google/callback", req.nextUrl.origin).toString();
  return NextResponse.redirect(getAuthUrl(redirectUri));
}
