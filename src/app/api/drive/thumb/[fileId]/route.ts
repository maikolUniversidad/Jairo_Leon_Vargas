import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getDriveThumbnail } from "@/lib/google-drive";

/**
 * Miniatura de un archivo de Drive, servida por la propia aplicación.
 *
 * El `webViewLink` que guardamos en la base de datos es una página HTML, así que
 * no sirve para un `<img>`. Aquí pedimos a Drive su `thumbnailLink` con el token
 * del servidor y reenviamos los bytes. Pesan decenas de kilobytes, así que el
 * ancho de banda es despreciable, y funciona aunque el permiso público del
 * archivo no se haya aplicado.
 *
 * La caché es `private`: la respuesta queda en el navegador de quien la pidió,
 * nunca en el CDN compartido.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("No autorizado", { status: 401 });

  const { fileId } = await params;
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
    return new NextResponse("Identificador no válido", { status: 400 });
  }

  const requested = Number(new URL(request.url).searchParams.get("w") ?? 400);
  const width = Number.isFinite(requested) ? Math.min(Math.max(requested, 100), 1600) : 400;

  const thumb = await getDriveThumbnail(fileId, width);
  // 404 es el caso normal de un archivo recién subido: Drive aún no generó la
  // miniatura. La tarjeta muestra el ícono del tipo y reintenta más tarde.
  if (!thumb) return new NextResponse("Sin miniatura", { status: 404 });

  return new NextResponse(thumb.body, {
    headers: {
      "Content-Type": thumb.contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
