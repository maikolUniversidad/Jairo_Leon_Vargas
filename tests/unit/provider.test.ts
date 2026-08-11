import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MODELO_POR_DEFECTO, providerAvailable, resolveProvider } from "@/lib/ia/provider";

/**
 * Estas pruebas nacen de un fallo real en producción: se pasó "auto" como
 * modelo y viajó tal cual a DeepSeek, que respondió 400. Los tipos no lo ven
 * —"auto" es un string válido— y el build tampoco. Solo una prueba lo atrapa.
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = "llave-deepseek";
  process.env.OPENAI_API_KEY = "llave-openai";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("resolveProvider · modelo", () => {
  it("traduce los centinelas al modelo por defecto en vez de mandarlos a la API", () => {
    for (const sentinela of ["auto", "AUTO", "  auto  ", "", "default", "por-defecto"]) {
      expect(resolveProvider(sentinela).model, `«${sentinela}» llegó tal cual`).toBe(
        MODELO_POR_DEFECTO,
      );
    }
  });

  it("el modelo por defecto es uno que DeepSeek acepta", () => {
    // Verificado contra la API: deepseek-chat responde 200.
    expect(MODELO_POR_DEFECTO).toBe("deepseek-chat");
  });

  it("respeta el modelo cuando se pide uno concreto", () => {
    expect(resolveProvider("deepseek-reasoner").model).toBe("deepseek-reasoner");
    expect(resolveProvider("gpt-4o-mini").model).toBe("gpt-4o-mini");
  });

  it("recorta espacios alrededor del nombre", () => {
    expect(resolveProvider("  deepseek-reasoner  ").model).toBe("deepseek-reasoner");
  });
});

describe("resolveProvider · proveedor", () => {
  it("manda los modelos de OpenAI a OpenAI", () => {
    for (const m of ["gpt-4o-mini", "o1-mini", "o3-mini"]) {
      const r = resolveProvider(m);
      expect(r.name, m).toBe("openai");
      expect(r.url).toContain("api.openai.com");
    }
  });

  it("todo lo demás va a DeepSeek", () => {
    const r = resolveProvider("deepseek-chat");
    expect(r.name).toBe("deepseek");
    expect(r.url).toContain("api.deepseek.com");
  });

  it("solo OpenAI declara visión", () => {
    expect(resolveProvider("gpt-4o-mini").vision).toBe(true);
    expect(resolveProvider("deepseek-chat").vision).toBe(false);
  });
});

describe("resolveProvider · llaves", () => {
  it("lanza un mensaje legible si falta la llave de DeepSeek", () => {
    delete process.env.DEEPSEEK_API_KEY;
    expect(() => resolveProvider("deepseek-chat")).toThrow(/DEEPSEEK_API_KEY/);
  });

  it("lanza un mensaje legible si falta la de OpenAI", () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => resolveProvider("gpt-4o-mini")).toThrow(/OPENAI_API_KEY/);
  });

  it("providerAvailable refleja si hay llave, sin lanzar", () => {
    expect(providerAvailable("deepseek-chat")).toBe(true);
    delete process.env.DEEPSEEK_API_KEY;
    expect(providerAvailable("deepseek-chat")).toBe(false);
    expect(providerAvailable("gpt-4o-mini")).toBe(true);
  });
});
