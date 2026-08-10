/**
 * Miniaturas locales para la pantalla de revisión, antes de subir nada.
 *
 * Las de video son caras: cada una monta un <video>, busca un fotograma y lo
 * pinta en un canvas. Por eso van con límite de concurrencia, igual que la cola
 * de subida.
 */

/**
 * Corre `fn` sobre cada elemento con un máximo de `limite` en vuelo.
 *
 * Conserva el orden de entrada. Un fallo deja `null` en su posición en vez de
 * tumbar el lote entero: una miniatura que no sale no puede impedir una subida.
 */
export async function conLimite<T, R>(
  items: T[],
  limite: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  if (items.length === 0) return out;

  let siguiente = 0;
  const obrero = async (): Promise<void> => {
    for (;;) {
      const i = siguiente++;
      if (i >= items.length) return;
      try {
        out[i] = await fn(items[i]!, i);
      } catch {
        out[i] = null;
      }
    }
  };

  // Un límite de 0 o negativo dejaría el lote sin procesar: se fuerza a 1.
  const obreros = Math.max(1, Math.min(limite, items.length));
  await Promise.all(Array.from({ length: obreros }, obrero));
  return out;
}

/* ────────────────────────────── Miniaturas ────────────────────────────── */

/** Tres a la vez, como la cola de subida. */
export const MINIATURAS_CONCURRENTES = 3;
/** Segundo del que se saca el fotograma: el 0 suele ser negro. */
const SEGUNDO_FOTOGRAMA = 0.5;
const ANCHO_MINIATURA = 320;
/** Un codec que el navegador no sabe decodificar se cuelga sin lanzar error. */
const TIMEOUT_VIDEO = 10_000;

/**
 * URL de objeto con la miniatura, o null si no se pudo generar.
 *
 * Quien llama es responsable de revocar la URL: con 200 archivos, no hacerlo
 * tumba la pestaña.
 */
export async function miniatura(file: File, kind: string): Promise<string | null> {
  if (kind === "imagen") return URL.createObjectURL(file);
  if (kind === "video") return miniaturaDeVideo(file);
  return null;
}

function miniaturaDeVideo(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let resuelto = false;

    const terminar = (out: string | null) => {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(reloj);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(out);
    };

    const reloj = setTimeout(() => terminar(null), TIMEOUT_VIDEO);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      video.currentTime = Math.min(SEGUNDO_FOTOGRAMA, (video.duration || 1) / 2);
    };

    video.onseeked = () => {
      try {
        const ancho = video.videoWidth || ANCHO_MINIATURA;
        const alto = video.videoHeight || ANCHO_MINIATURA;
        const canvas = document.createElement("canvas");
        canvas.width = ANCHO_MINIATURA;
        canvas.height = Math.round((alto * ANCHO_MINIATURA) / ancho);
        const ctx = canvas.getContext("2d");
        if (!ctx) return terminar(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => terminar(blob ? URL.createObjectURL(blob) : null),
          "image/jpeg",
          0.7,
        );
      } catch {
        terminar(null);
      }
    };

    video.onerror = () => terminar(null);
    video.src = url;
  });
}
