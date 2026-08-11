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
    { nombre: "Ana Ruiz", rol: "Ponente", vinculo: "aliado", organizacion: "JAC Kennedy" },
    { nombre: "Luis Pérez", rol: "Camarógrafo", vinculo: "equipo" },
    { nombre: "Carla Gómez", rol: null, vinculo: null },
  ];

  it("agrupa por vínculo: equipo, aliados y el resto", () => {
    const texto = construirBrief(minima, asistentes);
    expect(texto).toContain("### Quiénes estuvieron");
    expect(texto).toContain("**Del equipo (1)**");
    expect(texto).toContain("- Luis Pérez — Camarógrafo");
    expect(texto).toContain("**Aliados y organizaciones (1)**");
    expect(texto).toContain("**Otros asistentes (1)**");
  });

  it("junta el rol y la organización de cada persona", () => {
    const texto = construirBrief(minima, asistentes);
    expect(texto).toContain("- Ana Ruiz — Ponente · JAC Kennedy");
  });

  it("sin vínculo cae en «otros», y sin rol va el nombre solo", () => {
    const texto = construirBrief(minima, asistentes);
    // Sin rol ni organización, la línea es solo el nombre: nada de « — » suelto.
    expect(texto).toContain("- Carla Gómez");
    expect(texto).not.toContain("- Carla Gómez —");
  });

  it("el equipo va antes que los aliados", () => {
    const texto = construirBrief(minima, asistentes);
    expect(texto.indexOf("Del equipo")).toBeLessThan(texto.indexOf("Aliados y organizaciones"));
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

describe("construirBrief · procedencia del material", () => {
  const minimaLocal: BriefCobertura = { nombre: "Jornada" };

  it("dice de qué equipo y con qué dispositivo salió cada pieza", () => {
    const texto = construirBrief(minimaLocal, [], [
      {
        fase: "crudo",
        nombre: "DSC_0001.JPG",
        mime: "image/jpeg",
        descripcion: "Jairo saludando",
        equipo: "Equipo A",
        dispositivo: "Sony ILCE-7M3",
        responsable: "Diego Castaño",
      },
    ]);
    expect(texto).toContain("Equipo A · Sony ILCE-7M3 · resp. Diego Castaño");
    expect(texto).toContain("Jairo saludando");
    expect(texto).toContain("**Equipos que produjeron el material:** Equipo A");
  });

  it("lista una pieza aunque solo se sepa de dónde salió", () => {
    // Un nombre de cámara no aporta, pero «Equipo A» sí: se lista.
    const texto = construirBrief(minimaLocal, [], [
      { fase: "crudo", nombre: "IMG_9182.JPG", mime: "image/jpeg", equipo: "Equipo A" },
    ]);
    expect(texto).toContain("IMG_9182.JPG [Equipo A]");
  });

  it("no inventa corchetes cuando no hay procedencia", () => {
    const texto = construirBrief(minimaLocal, [], [
      { fase: "crudo", nombre: "IMG_1.JPG", mime: "image/jpeg", descripcion: "Algo" },
    ]);
    expect(texto).toContain("IMG_1.JPG: Algo");
    expect(texto).not.toContain("IMG_1.JPG [");
  });

  it("marca las piezas destacadas y las cuenta", () => {
    const texto = construirBrief(minimaLocal, [], [
      { fase: "crudo", nombre: "a.jpg", mime: "image/jpeg", descripcion: "x", destacado: true },
      { fase: "crudo", nombre: "b.jpg", mime: "image/jpeg", descripcion: "y" },
    ]);
    expect(texto).toContain("★ a.jpg");
    expect(texto).not.toContain("★ b.jpg");
    expect(texto).toContain("**Piezas destacadas (★):** 1 de 2");
  });

  it("incluye las etiquetas puestas a mano en la pieza", () => {
    const texto = construirBrief(minimaLocal, [], [
      { fase: "crudo", nombre: "a.jpg", mime: "image/jpeg", tags: ["salud", "kennedy"] },
    ]);
    expect(texto).toContain("Etiquetas: salud, kennedy");
  });
});

describe("construirBrief · transcripción del dictado", () => {
  const minimaLocal: BriefCobertura = { nombre: "Jornada" };

  it("incluye lo dicho y avisa de que viene de un audio", () => {
    const texto = construirBrief(minimaLocal, [], [], {
      transcripcion: "Fuimos al Palacio de Justicia y estuvo Marta Ospina.",
    });
    expect(texto).toContain("### Cómo lo contó el equipo");
    expect(texto).toContain("Fuimos al Palacio de Justicia y estuvo Marta Ospina.");
    expect(texto).toContain("no como cita literal");
  });

  it("va al final, después del material", () => {
    const texto = construirBrief(minimaLocal, [], [], { transcripcion: "Algo dicho." });
    expect(texto.indexOf("Material disponible")).toBeLessThan(
      texto.indexOf("Cómo lo contó el equipo"),
    );
  });

  it("omite la sección si no hay dictado o está vacío", () => {
    expect(construirBrief(minimaLocal)).not.toContain("Cómo lo contó el equipo");
    expect(construirBrief(minimaLocal, [], [], { transcripcion: "   " })).not.toContain(
      "Cómo lo contó el equipo",
    );
  });
});

describe("construirBrief · conteos y enlaces", () => {
  it("dice cuánta gente y cuánto material hay, y enlaza la carpeta de Drive", () => {
    const texto = construirBrief(
      { nombre: "Jornada", drive_link: "https://drive.google.com/x" },
      [{ nombre: "Ana", vinculo: "equipo" }],
      [{ fase: "crudo", nombre: "a.jpg", mime: "image/jpeg" }],
    );
    expect(texto).toContain("**Personas registradas:** 1");
    expect(texto).toContain("**Piezas de material:** 1");
    expect(texto).toContain("**Carpeta en Drive:** https://drive.google.com/x");
  });
});
