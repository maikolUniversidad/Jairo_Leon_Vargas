import { describe, expect, it } from "vitest";

import { chunkText } from "@/lib/kb/chunk";
import { cn, formatDate, initials } from "@/lib/utils";

describe("cn", () => {
  it("une clases y descarta lo vacío", () => {
    expect(cn("a", null, undefined, false && "b", "c")).toBe("a c");
  });

  it("la última clase de Tailwind gana en caso de conflicto", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-morado-600")).toBe("text-morado-600");
  });

  it("acepta objetos y arreglos condicionales", () => {
    expect(cn(["a", { b: true, c: false }])).toBe("a b");
  });
});

describe("initials", () => {
  it("toma la inicial de los dos primeros nombres", () => {
    expect(initials("Jairo León Vargas")).toBe("JL");
    expect(initials("Ana Pérez")).toBe("AP");
  });

  it("funciona con un solo nombre", () => {
    expect(initials("Ana")).toBe("A");
  });

  it("tolera espacios de sobra", () => {
    expect(initials("   Ana   Pérez  ")).toBe("AP");
  });

  it("cae a JLV cuando no hay nombre", () => {
    expect(initials(null)).toBe("JLV");
    expect(initials(undefined)).toBe("JLV");
    expect(initials("")).toBe("JLV");
  });
});

describe("formatDate", () => {
  it("formatea en español de Colombia", () => {
    const out = formatDate("2026-03-15T10:00:00.000Z");
    expect(out).toMatch(/2026/);
    expect(out).not.toBe("—");
  });

  it("acepta objetos Date", () => {
    expect(formatDate(new Date("2026-03-15T10:00:00.000Z"))).toMatch(/2026/);
  });

  it("devuelve guion en vez de `Invalid Date`", () => {
    expect(formatDate("no es una fecha")).toBe("—");
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });
});

describe("chunkText (base de conocimiento)", () => {
  it("no genera nada con texto vacío", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("un texto corto cabe en un solo fragmento", () => {
    const c = chunkText("Un párrafo corto de prueba.");
    expect(c).toHaveLength(1);
    expect(c[0]!.content).toBe("Un párrafo corto de prueba.");
    expect(c[0]!.tokens).toBeGreaterThan(0);
  });

  it("normaliza saltos de Windows y espacios repetidos", () => {
    const c = chunkText("Hola\r\n\r\nmundo    con   espacios");
    expect(c[0]!.content).not.toContain("\r");
    expect(c[0]!.content).not.toMatch(/ {2,}/);
  });

  it("parte los textos largos en varios fragmentos", () => {
    const parrafo = "Frase de relleno para medir el corte. ".repeat(30);
    const c = chunkText(Array.from({ length: 6 }, () => parrafo).join("\n\n"));
    expect(c.length).toBeGreaterThan(1);
  });

  it("solapa fragmentos consecutivos para no perder contexto en las fronteras", () => {
    const parrafo = "Frase de relleno para medir el corte. ".repeat(30);
    const c = chunkText(Array.from({ length: 6 }, () => parrafo).join("\n\n"));
    expect(c[1]!.content).toContain("…");
  });

  it("parte también un párrafo único gigante, sin quedarse en un solo bloque", () => {
    const c = chunkText("palabra ".repeat(2000));
    expect(c.length).toBeGreaterThan(1);
  });

  it("estima tokens de forma creciente con el tamaño", () => {
    const corto = chunkText("hola")[0]!;
    const largo = chunkText("hola ".repeat(100))[0]!;
    expect(largo.tokens).toBeGreaterThan(corto.tokens);
  });
});
