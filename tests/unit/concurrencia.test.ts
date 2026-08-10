import { describe, expect, it } from "vitest";

import { conLimite } from "@/lib/thumbnails";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("conLimite", () => {
  it("devuelve los resultados en el orden de entrada, no en el de terminación", async () => {
    const out = await conLimite([3, 1, 2], 2, async (n) => {
      await espera(n * 10);
      return n * 10;
    });
    expect(out).toEqual([30, 10, 20]);
  });

  it("nunca corre más de N a la vez", async () => {
    let vivos = 0;
    let pico = 0;
    await conLimite(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      vivos += 1;
      pico = Math.max(pico, vivos);
      await espera(5);
      vivos -= 1;
      return null;
    });
    expect(pico).toBeLessThanOrEqual(3);
    expect(pico).toBeGreaterThan(1); // y sí paraleliza, no va de uno en uno
  });

  it("procesa todos los elementos", async () => {
    const vistos: number[] = [];
    await conLimite([1, 2, 3, 4, 5], 2, async (n) => {
      vistos.push(n);
      return n;
    });
    expect(vistos.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("un fallo no tumba el lote: esa posición queda en null", async () => {
    const out = await conLimite([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("truena");
      return n;
    });
    expect(out).toEqual([1, null, 3]);
  });

  it("pasa el índice a la función", async () => {
    const out = await conLimite(["a", "b", "c"], 2, async (s, i) => `${s}${i}`);
    expect(out).toEqual(["a0", "b1", "c2"]);
  });

  it("con lista vacía no hace nada y no se cuelga", async () => {
    expect(await conLimite([], 3, async () => 1)).toEqual([]);
  });

  it("con límite mayor que la lista no lanza obreros de más", async () => {
    const out = await conLimite([1, 2], 10, async (n) => n * 2);
    expect(out).toEqual([2, 4]);
  });

  it("con límite 0 o negativo sigue avanzando en vez de colgarse", async () => {
    expect(await conLimite([1, 2], 0, async (n) => n)).toEqual([1, 2]);
    expect(await conLimite([1, 2], -5, async (n) => n)).toEqual([1, 2]);
  });
});
