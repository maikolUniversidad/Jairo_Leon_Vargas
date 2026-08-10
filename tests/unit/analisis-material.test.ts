import { describe, expect, it } from "vitest";

import {
  AnalisisInvalido,
  AnalisisNoAplicable,
  construirMensajes,
  MODELO_TEXTO,
  MODELO_VISION,
  MAX_TEXTO_DOCUMENTO,
  modeloPara,
  parsearResultado,
  redactarAnalisis,
} from "@/lib/ia/analisis-material";

// Lo que devuelve el modelo entra directo en el brief que se le pega a la IA y
// en la ficha del archivo. Si el parseo acepta basura, esa basura acaba
// presentándose al equipo como si fuera un dato.

describe("modeloPara", () => {
  it("solo pide visión donde hace falta", () => {
    expect(modeloPara("foto")).toBe(MODELO_VISION);
    expect(modeloPara("video")).toBe(MODELO_VISION);
    expect(modeloPara("documento")).toBe(MODELO_TEXTO);
  });

  it("rechaza los tipos que no se analizan", () => {
    expect(() => modeloPara("audio")).toThrow(AnalisisNoAplicable);
    expect(() => modeloPara("otro")).toThrow(AnalisisNoAplicable);
  });
});

describe("construirMensajes", () => {
  it("manda la imagen para fotos y videos", () => {
    const msgs = construirMensajes({
      tipo: "foto",
      nombre: "DSC_1.jpg",
      imagenDataUrl: "data:image/jpeg;base64,AAA",
    });
    expect(msgs[0]?.role).toBe("system");
    const contenido = msgs[1]?.content;
    expect(Array.isArray(contenido)).toBe(true);
    expect(JSON.stringify(contenido)).toContain("data:image/jpeg;base64,AAA");
  });

  it("avisa al video de que solo ve un fotograma", () => {
    const [sistema] = construirMensajes({
      tipo: "video",
      nombre: "clip.mp4",
      imagenDataUrl: "data:image/jpeg;base64,AAA",
    });
    expect(sistema?.content).toContain("FOTOGRAMA");
    expect(sistema?.content).toContain("no supongas");
  });

  it("prohíbe identificar personas por nombre", () => {
    for (const tipo of ["foto", "video"] as const) {
      const [sistema] = construirMensajes({
        tipo,
        nombre: "x",
        imagenDataUrl: "data:image/jpeg;base64,AAA",
      });
      expect(sistema?.content, tipo).toContain("NUNCA identifiques a nadie por su nombre");
    }
  });

  it("sin miniatura todavía no es analizable", () => {
    expect(() => construirMensajes({ tipo: "foto", nombre: "x.jpg" })).toThrow(AnalisisNoAplicable);
  });

  it("un documento sin texto legible no se reintenta", () => {
    expect(() => construirMensajes({ tipo: "documento", nombre: "escaneo.pdf", texto: "   " }))
      .toThrow(AnalisisNoAplicable);
  });

  it("recorta el texto largo de un documento", () => {
    const largo = "a".repeat(MAX_TEXTO_DOCUMENTO * 2);
    const msgs = construirMensajes({ tipo: "documento", nombre: "acta.pdf", texto: largo });
    expect(String(msgs[1]?.content).length).toBeLessThan(MAX_TEXTO_DOCUMENTO + 200);
  });

  it("el audio nunca llega al proveedor", () => {
    expect(() => construirMensajes({ tipo: "audio", nombre: "voz.m4a" })).toThrow(AnalisisNoAplicable);
  });
});

describe("parsearResultado", () => {
  const bueno = '{"resumen":"Vecinos en la calle.","utilidad":"Sirve de portada.","etiquetas":["calle","vecinos"]}';

  it("lee un JSON limpio", () => {
    const r = parsearResultado(bueno);
    expect(r.resumen).toBe("Vecinos en la calle.");
    expect(r.utilidad).toBe("Sirve de portada.");
    expect(r.etiquetas).toEqual(["calle", "vecinos"]);
  });

  it("tolera el bloque ```json con el que responden algunos modelos", () => {
    expect(parsearResultado("```json\n" + bueno + "\n```").resumen).toBe("Vecinos en la calle.");
  });

  it("tolera una frase antes del objeto", () => {
    expect(parsearResultado("Claro, aquí tienes: " + bueno).resumen).toBe("Vecinos en la calle.");
  });

  it("normaliza etiquetas: minúscula, sin almohadilla y sin repetir", () => {
    const r = parsearResultado('{"resumen":"x","etiquetas":["#Calle","calle","CALLE","Vecinos"]}');
    expect(r.etiquetas).toEqual(["calle", "vecinos"]);
  });

  it("corta en seis etiquetas", () => {
    const muchas = JSON.stringify({ resumen: "x", etiquetas: ["a","b","c","d","e","f","g","h"] });
    expect(parsearResultado(muchas).etiquetas).toHaveLength(6);
  });

  it("acepta que falte la utilidad, pero no el resumen", () => {
    expect(parsearResultado('{"resumen":"x"}').utilidad).toBe("");
    expect(() => parsearResultado('{"utilidad":"y"}')).toThrow(AnalisisInvalido);
    expect(() => parsearResultado('{"resumen":"   "}')).toThrow(AnalisisInvalido);
  });

  it("rechaza lo que no es JSON en vez de guardarlo como resumen", () => {
    expect(() => parsearResultado("No puedo analizar esta imagen.")).toThrow(AnalisisInvalido);
    expect(() => parsearResultado("[1,2,3]")).toThrow(AnalisisInvalido);
  });
});

describe("redactarAnalisis", () => {
  const r = { resumen: "Vecinos en la calle.", utilidad: "Sirve de portada.", etiquetas: [] };

  it("une resumen y utilidad", () => {
    expect(redactarAnalisis("foto", r)).toBe("Vecinos en la calle. Utilidad: Sirve de portada.");
  });

  it("en video deja constancia de que fue un fotograma", () => {
    expect(redactarAnalisis("video", r)).toContain("basado en un fotograma");
  });

  it("no inventa la utilidad si vino vacía", () => {
    expect(redactarAnalisis("foto", { ...r, utilidad: "" })).toBe("Vecinos en la calle.");
  });
});
