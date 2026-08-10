import { describe, expect, it } from "vitest";

import {
  construirBrief,
  type BriefArchivo,
  type BriefAsistente,
  type BriefCobertura,
} from "@/lib/cobertura-brief";

// El brief es lo que el equipo le pega a la IA para que redacte. Si mete campos
// vacíos, la IA los toma como datos reales y alucina; si omite el material
// disponible, propone piezas que no se pueden hacer. Por eso se prueba el texto.

const minima: BriefCobertura = { nombre: "Recorrido Kennedy" };

const completa: BriefCobertura = {
  nombre: "Recorrido Kennedy",
  descripcion: "Recorrido por el barrio con la comunidad.",
  fecha: "2026-06-14",
  lugar: "Kennedy, Bogotá",
  estado: "en_edicion",
  objetivo: "Escuchar a los vecinos sobre movilidad.",
  resumen: "Se caminó la carrera 80 y se hizo una reunión en el salón comunal.",
  mensajes_clave: "La 80 necesita andenes.\nLa ruta alimentadora se amplía en julio.",
  temas: ["movilidad", "espacio público"],
  resultados: "Se levantaron 40 firmas.",
  compromisos: "Radicar la petición de andenes antes del 30 de junio.",
  aliados: "Junta de Acción Comunal",
  publico_estimado: 120,
  hashtags: ["#Kennedy", "#Movilidad"],
};

describe("construirBrief", () => {
  it("omite los campos vacíos en vez de escribirlos en blanco", () => {
    const texto = construirBrief(minima);
    expect(texto).toContain("## Cobertura: Recorrido Kennedy");
    expect(texto).not.toContain("Lugar");
    expect(texto).not.toContain("Objetivo");
    expect(texto).not.toContain("Hashtags");
    expect(texto).not.toMatch(/:\s*$/m);
  });

  it("trata como vacío el texto que solo tiene espacios", () => {
    const texto = construirBrief({ ...minima, lugar: "   ", objetivo: "\n " });
    expect(texto).not.toContain("Lugar");
    expect(texto).not.toContain("Objetivo");
  });

  it("incluye todos los bloques de una ficha completa", () => {
    const texto = construirBrief(completa);
    expect(texto).toContain("**Fecha:** 2026-06-14");
    expect(texto).toContain("**Lugar:** Kennedy, Bogotá");
    expect(texto).toContain("**Público estimado:** 120");
    expect(texto).toContain("**Temas:** movilidad, espacio público");
    expect(texto).toContain("**Hashtags:** #Kennedy, #Movilidad");
    expect(texto).toContain("### Objetivo");
    expect(texto).toContain("### Qué se hizo");
    expect(texto).toContain("### Mensajes clave");
    expect(texto).toContain("### Resultados");
    expect(texto).toContain("### Compromisos");
  });

  it("normaliza el estado para que se lea", () => {
    expect(construirBrief(completa)).toContain("**Estado:** en edicion");
  });

  it("abre con una instrucción, no con datos sueltos", () => {
    expect(construirBrief(minima).startsWith("Esta es la información")).toBe(true);
  });

  it("no incluye el público estimado cuando es cero o nulo", () => {
    expect(construirBrief({ ...minima, publico_estimado: 0 })).not.toContain("Público estimado");
    expect(construirBrief({ ...minima, publico_estimado: null })).not.toContain("Público estimado");
  });
});

describe("construirBrief · asistentes", () => {
  const asistentes: BriefAsistente[] = [
    { nombre: "Ana Ruiz", rol: "Ponente", vinculo: "contacto" },
    { nombre: "Luis Pérez", rol: "Ponente", vinculo: null },
    { nombre: "Carla Gómez", rol: null, vinculo: "ciudadano" },
  ];

  it("agrupa por rol y usa «Asistentes» cuando no hay", () => {
    const texto = construirBrief(minima, asistentes);
    expect(texto).toContain("### Quiénes estuvieron");
    expect(texto).toContain("**Ponente:** Ana Ruiz, Luis Pérez");
    expect(texto).toContain("**Asistentes:** Carla Gómez");
  });

  it("omite la sección entera si no hay nadie", () => {
    expect(construirBrief(minima, [])).not.toContain("Quiénes estuvieron");
  });
});

describe("construirBrief · material", () => {
  const archivos: BriefArchivo[] = [
    { fase: "crudo", nombre: "DSC_0001.CR2", mime: null },
    { fase: "crudo", nombre: "DSC_0002.CR2", mime: null },
    { fase: "crudo", nombre: "clip.mov", mime: "video/quicktime" },
    {
      fase: "aprobado",
      nombre: "reel-final.mp4",
      mime: "video/mp4",
      descripcion: "Reel de 30 s con el cierre en el salón comunal.",
    },
  ];

  it("cuenta las piezas por fase y por tipo", () => {
    const texto = construirBrief(minima, [], archivos);
    expect(texto).toContain("**Contenido Crudo:** 2 fotos y 1 video");
    expect(texto).toContain("**Contenido Aprobado:** 1 video");
    expect(texto).not.toContain("Contenido Editado");
  });

  it("lista solo las piezas que tienen descripción", () => {
    const texto = construirBrief(minima, [], archivos);
    expect(texto).toContain("reel-final.mp4: Reel de 30 s con el cierre en el salón comunal.");
    expect(texto).not.toContain("DSC_0001.CR2:");
  });

  it("dice explícitamente cuando no hay material", () => {
    expect(construirBrief(minima, [], [])).toContain("Todavía no se ha subido contenido");
  });

  it("usa singular con una sola pieza", () => {
    const texto = construirBrief(minima, [], [{ fase: "crudo", nombre: "a.jpg", mime: "image/jpeg" }]);
    expect(texto).toContain("**Contenido Crudo:** 1 foto");
  });
});

describe("construirBrief · análisis automático", () => {
  const analizado: BriefArchivo = {
    fase: "crudo",
    nombre: "DSC_9.jpg",
    mime: "image/jpeg",
    analisis: "Vecinos reunidos en un salón comunal. Utilidad: sirve de apoyo.",
    analisis_etiquetas: ["comunidad", "reunion"],
  };

  it("lista piezas que solo tienen análisis, no solo las descritas a mano", () => {
    const texto = construirBrief(minima, [], [analizado]);
    expect(texto).toContain("DSC_9.jpg: Análisis: Vecinos reunidos");
  });

  it("la descripción escrita a mano va primero y el análisis la completa", () => {
    const texto = construirBrief(minima, [], [{ ...analizado, descripcion: "Foto de portada." }]);
    expect(texto).toContain("DSC_9.jpg: Foto de portada. — Análisis: Vecinos reunidos");
  });

  it("no repite el texto cuando descripción y análisis coinciden", () => {
    const texto = construirBrief(minima, [], [{ ...analizado, descripcion: analizado.analisis }]);
    expect(texto).not.toContain("— Análisis:");
  });

  it("agrega las etiquetas detectadas y las ordena por frecuencia", () => {
    const texto = construirBrief(minima, [], [
      analizado,
      { ...analizado, nombre: "b.jpg", analisis_etiquetas: ["reunion", "andenes"] },
    ]);
    expect(texto).toContain("**Temas detectados en el material:** reunion,");
  });

  it("advierte que el análisis es automático, pero solo si hay alguno", () => {
    expect(construirBrief(minima, [], [analizado])).toContain("las generó un modelo");
    expect(construirBrief(minima, [], [{ fase: "crudo", nombre: "a.jpg", mime: "image/jpeg" }]))
      .not.toContain("las generó un modelo");
  });

  it("no inventa la sección de temas si ninguna pieza trae etiquetas", () => {
    const texto = construirBrief(minima, [], [{ ...analizado, analisis_etiquetas: [] }]);
    expect(texto).not.toContain("Temas detectados");
  });
});
