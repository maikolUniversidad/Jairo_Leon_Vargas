// Recursos de marca para la página /misredes, como SVG data-URI autocontenidos
// (livianos y fiables). El logo reproduce el lockup oficial (sticker magenta +
// "JAIRO / LEÓN VARGAS" + barras del Pacto). Las fotos de perfil/destacada se
// suben desde el panel. Si prefieres el PNG exacto, colócalo en
// public/misredes-logo.png y avísame para apuntar el logo a ese archivo.

const svg = (s: string) => `data:image/svg+xml,${encodeURIComponent(s.replace(/\s+/g, " ").trim())}`;

/** Logo oficial de Jairo (imagen PNG con transparencia, en public/). */
export const LOGO_JAIRO = "/misredes-logo.png";

/** Logo oficial de la coalición Pacto Histórico (PNG con transparencia, en public/). */
export const LOGO_PACTO = "/pacto-historico.png";

/**
 * Portadas de las "destacadas" (J·A·I·R·O): PNG oficiales con la letra blanca
 * sobre el degradado morado de marca (en public/Jairo Letras/). Se recortan en
 * círculo desde el CSS (`.dest .circle` → border-radius:50% + object-fit:cover),
 * así que basta el archivo cuadrado.
 */
export const COVERS: Record<string, string> = {
  J: "/Jairo%20Letras/J.png",
  A: "/Jairo%20Letras/A.png",
  I: "/Jairo%20Letras/I.png",
  R: "/Jairo%20Letras/R.png",
  O: "/Jairo%20Letras/O.png",
};
