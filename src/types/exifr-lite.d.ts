/**
 * `exifr` solo tipa su entrada principal (el build `full`). Nosotros importamos
 * el subpath `lite`, que es el más pequeño que sí devuelve Make/Model — el
 * `mini` devuelve `{}` y el `full` pesa 29 KB más sin aportar nada aquí.
 *
 * Ojo: `lite` NO acepta la opción `pick` (lanza `undefined is not iterable`),
 * por eso la firma es solo `parse(datos)`.
 */
declare module "exifr/dist/lite.esm.mjs" {
  export function parse(datos: Uint8Array | ArrayBuffer): Promise<Record<string, unknown> | null>;
  const exifr: {
    parse: (datos: Uint8Array | ArrayBuffer) => Promise<Record<string, unknown> | null>;
  };
  export default exifr;
}
