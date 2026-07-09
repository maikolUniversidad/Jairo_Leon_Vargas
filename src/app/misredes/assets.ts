// Recursos de marca para la página /misredes, como SVG data-URI autocontenidos
// (livianos y fiables). El logo reproduce el lockup oficial (sticker magenta +
// "JAIRO / LEÓN VARGAS" + barras del Pacto). Las fotos de perfil/destacada se
// suben desde el panel. Si prefieres el PNG exacto, colócalo en
// public/misredes-logo.png y avísame para apuntar el logo a ese archivo.

const svg = (s: string) => `data:image/svg+xml,${encodeURIComponent(s.replace(/\s+/g, " ").trim())}`;

/** Logo oficial de Jairo (imagen PNG con transparencia, en public/). */
export const LOGO_JAIRO = "/misredes-logo.png";

/** Marca coalición Pacto Histórico (barras + texto). */
export const LOGO_PACTO = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 56">
  <g>
    <rect x="0" y="0" width="54" height="9" rx="4.5" fill="#f2a03d"/>
    <rect x="60" y="0" width="54" height="9" rx="4.5" fill="#2e3192"/>
    <rect x="120" y="0" width="54" height="9" rx="4.5" fill="#e4322b"/>
    <rect x="180" y="0" width="54" height="9" rx="4.5" fill="#10984e"/>
    <rect x="240" y="0" width="54" height="9" rx="4.5" fill="#7a2e7e"/>
  </g>
  <text x="150" y="42" text-anchor="middle" font-family="'Helvetica Neue',Arial,sans-serif"
        font-weight="800" font-size="26" letter-spacing="2" fill="#ffffff">PACTO HISTÓRICO</text>
</svg>
`);

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
