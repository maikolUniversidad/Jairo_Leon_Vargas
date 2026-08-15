import { describe, expect, it } from "vitest";

import {
  HORAS_CACHE,
  NIVELES,
  ZONA_NACION,
  cacheVencida,
  consultaZona,
  departamentoDeMunicipio,
  parseZonaKey,
  zonaKey,
  zonaLabel,
  type Zona,
} from "@/lib/territorio";

const municipio = (nombre: string, departamento: string, codigo = "05001"): Zona => ({
  nivel: "municipio",
  codigo,
  nombre,
  departamento,
});

describe("zonaKey / parseZonaKey", () => {
  it("van y vuelven", () => {
    const z = { nivel: "municipio" as const, codigo: "05001" };
    expect(parseZonaKey(zonaKey(z))).toEqual(z);
  });

  it("distingue zonas del mismo código en niveles distintos", () => {
    expect(zonaKey({ nivel: "departamento", codigo: "05" })).not.toBe(
      zonaKey({ nivel: "municipio", codigo: "05" }),
    );
  });

  it("rechaza llaves inválidas", () => {
    expect(parseZonaKey("")).toBeNull();
    expect(parseZonaKey("municipio")).toBeNull();
    expect(parseZonaKey("inventado:05001")).toBeNull();
    expect(parseZonaKey(":05001")).toBeNull();
  });

  it("la nación tiene su propia llave", () => {
    expect(zonaKey(ZONA_NACION)).toBe("nacion:CO");
    expect(NIVELES).toContain("nacion");
  });
});

describe("departamentoDeMunicipio", () => {
  it("toma los dos primeros dígitos del código divipola", () => {
    expect(departamentoDeMunicipio("05001")).toBe("05"); // Medellín → Antioquia
    expect(departamentoDeMunicipio("11001")).toBe("11"); // Bogotá
    expect(departamentoDeMunicipio("44847")).toBe("44"); // Uribia → La Guajira
  });

  it("rellena el cero cuando el código viene sin él", () => {
    // Algunas fuentes traen 5001 en vez de 05001.
    expect(departamentoDeMunicipio("5001")).toBe("05");
  });
});

describe("consultaZona", () => {
  it("la nación pregunta por Colombia", () => {
    expect(consultaZona(ZONA_NACION)).toBe("Colombia");
  });

  it("un departamento se ancla a Colombia", () => {
    expect(consultaZona({ nivel: "departamento", codigo: "05", nombre: "Antioquia" })).toBe(
      '"Antioquia" Colombia',
    );
  });

  it("un municipio con nombre propio no necesita el departamento", () => {
    expect(consultaZona(municipio("Medellín", "Antioquia"))).toBe('"Medellín" Colombia');
  });

  it("los nombres ambiguos SÍ llevan el departamento", () => {
    // «Córdoba» solo devolvería noticias de España o de Argentina.
    expect(consultaZona(municipio("Córdoba", "Quindío"))).toBe('"Córdoba" "Quindío" Colombia');
    expect(consultaZona(municipio("Sevilla", "Valle del Cauca"))).toContain('"Valle del Cauca"');
    expect(consultaZona(municipio("California", "Santander"))).toContain('"Santander"');
  });

  it("detecta la ambigüedad sin importar tildes ni mayúsculas", () => {
    expect(consultaZona(municipio("CÓRDOBA", "Bolívar"))).toContain('"Bolívar"');
    expect(consultaZona(municipio("cordoba", "Nariño"))).toContain('"Nariño"');
  });

  it("sin departamento conocido no se inventa nada", () => {
    const z: Zona = { nivel: "municipio", codigo: "05001", nombre: "Córdoba", departamento: null };
    expect(consultaZona(z)).toBe('"Córdoba" Colombia');
  });

  it("siempre ancla a Colombia, en todos los niveles", () => {
    expect(consultaZona(municipio("Medellín", "Antioquia"))).toContain("Colombia");
    expect(consultaZona({ nivel: "departamento", codigo: "05", nombre: "Antioquia" })).toContain(
      "Colombia",
    );
  });
});

describe("zonaLabel", () => {
  it("un municipio se lee con su departamento", () => {
    expect(zonaLabel(municipio("Medellín", "Antioquia"))).toBe("Medellín, Antioquia");
  });

  it("un departamento va solo", () => {
    expect(zonaLabel({ nivel: "departamento", codigo: "05", nombre: "Antioquia" })).toBe("Antioquia");
  });

  it("un municipio sin departamento no deja una coma suelta", () => {
    expect(zonaLabel({ nivel: "municipio", codigo: "05001", nombre: "Medellín" })).toBe("Medellín");
  });
});

describe("cacheVencida", () => {
  const ahora = new Date("2026-08-15T12:00:00Z");

  it("sin recolección previa, hay que consultar", () => {
    expect(cacheVencida(null, ahora)).toBe(true);
    expect(cacheVencida(undefined, ahora)).toBe(true);
  });

  it("una recolección reciente sigue sirviendo", () => {
    expect(cacheVencida("2026-08-15T10:00:00Z", ahora)).toBe(false);
  });

  it("pasadas las horas de caché, se vuelve a consultar", () => {
    expect(cacheVencida("2026-08-15T05:00:00Z", ahora)).toBe(true);
  });

  it("justo en el límite todavía sirve", () => {
    const limite = new Date(ahora.getTime() - HORAS_CACHE * 3600_000 + 1000);
    expect(cacheVencida(limite, ahora)).toBe(false);
  });

  it("una fecha corrupta se trata como vencida, no revienta", () => {
    expect(cacheVencida("no es una fecha", ahora)).toBe(true);
  });
});
