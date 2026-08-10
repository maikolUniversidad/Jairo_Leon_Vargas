import { describe, expect, it } from "vitest";

import { ordenarParaRecorrido, type PiezaVisor } from "@/components/dashboard/cobertura-visor-carrusel";

// El recorrido del visor tiene que terminar una fase antes de pasar a la
// siguiente: así se revisa el material en la práctica (todo el crudo, luego lo
// editado, luego lo aprobado). Si el orden se mezcla, revisar es un caos.

const pieza = (id: string, fase: PiezaVisor["fase"]): PiezaVisor => ({
  id,
  fase,
  nombre: `${id}.jpg`,
  url: `https://x/${id}`,
});

describe("ordenarParaRecorrido", () => {
  it("agrupa por fase en el orden crudo → editado → aprobado", () => {
    const orden = ordenarParaRecorrido([
      pieza("c1", "aprobado"),
      pieza("a1", "crudo"),
      pieza("b1", "editado"),
      pieza("a2", "crudo"),
    ]);
    expect(orden.map((p) => p.id)).toEqual(["a1", "a2", "b1", "c1"]);
  });

  it("respeta el orden previo dentro de cada fase", () => {
    const orden = ordenarParaRecorrido([
      pieza("a3", "crudo"),
      pieza("a1", "crudo"),
      pieza("a2", "crudo"),
    ]);
    expect(orden.map((p) => p.id)).toEqual(["a3", "a1", "a2"]);
  });

  it("no muta la lista que recibe", () => {
    const original = [pieza("b", "editado"), pieza("a", "crudo")];
    const copia = [...original];
    ordenarParaRecorrido(original);
    expect(original).toEqual(copia);
  });

  it("aguanta listas vacías y de un solo elemento", () => {
    expect(ordenarParaRecorrido([])).toEqual([]);
    expect(ordenarParaRecorrido([pieza("a", "crudo")]).map((p) => p.id)).toEqual(["a"]);
  });
});
