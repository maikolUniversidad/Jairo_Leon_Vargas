// Recursos de marca para la página /misredes, como SVG data-URI autocontenidos
// (livianos y fiables). El logo reproduce el lockup oficial (sticker magenta +
// "JAIRO / LEÓN VARGAS" + barras del Pacto). Las fotos de perfil/destacada se
// suben desde el panel. Si prefieres el PNG exacto, colócalo en
// public/misredes-logo.png y avísame para apuntar el logo a ese archivo.

const svg = (s: string) => `data:image/svg+xml,${encodeURIComponent(s.replace(/\s+/g, " ").trim())}`;

/** Logo oficial de Jairo (sticker magenta + nombre + barras del Pacto). */
export const LOGO_JAIRO = svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560">
  <rect x="46" y="46" width="708" height="468" rx="98" fill="#a73194" stroke="#f6f0f5" stroke-width="10"/>
  <text x="400" y="280" text-anchor="middle"
        font-family="'Arial Black','Helvetica Neue',Arial,sans-serif"
        font-weight="900" font-size="188" letter-spacing="4" fill="#ffffff">JAIRO</text>
  <text x="400" y="406" text-anchor="middle"
        font-family="'Helvetica Neue',Arial,sans-serif"
        font-weight="600" font-size="86" letter-spacing="6" fill="#ffffff">LEÓN VARGAS</text>
  <g>
    <rect x="158" y="452" width="88" height="16" rx="8" fill="#f2a03d"/>
    <rect x="256" y="452" width="88" height="16" rx="8" fill="#2e3192"/>
    <rect x="354" y="452" width="88" height="16" rx="8" fill="#e4322b"/>
    <rect x="452" y="452" width="88" height="16" rx="8" fill="#10984e"/>
    <rect x="550" y="452" width="88" height="16" rx="8" fill="#7a2e7e"/>
  </g>
</svg>
`);

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

/** Círculo con inicial para las "destacadas" (J·A·I·R·O). */
const letter = (ch: string, bg: string) => svg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${bg}"/>
  <text x="50" y="50" dy=".35em" text-anchor="middle"
        font-family="'Arial Black','Helvetica Neue',Arial,sans-serif" font-weight="900" font-size="54" fill="#ffffff">${ch}</text>
</svg>
`);

export const COVERS: Record<string, string> = {
  J: letter("J", "#7a2470"),
  A: letter("A", "#a73194"),
  I: letter("I", "#c94fb4"),
  R: letter("R", "#7a2e7e"),
  O: letter("O", "#a73194"),
};
