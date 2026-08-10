import { describe, expect, it } from "vitest";

import {
  CAMPOS_BASICOS,
  CAMPOS_FICHA,
  CAMPOS_PREGUNTA,
  CAMPO_LABEL,
  TIPO_CAMPO,
  acotar,
  preguntasAplicables,
  primeraPendiente,
  type Momento,
  type Pregunta,
} from "@/lib/cuestionario-shared";
import { normalizarFicha } from "@/lib/ia/extraer-ficha";

const pregunta = (id: string, orden: number, momento: Momento = "posterior"): Pregunta => ({
  id,
  pregunta: `P${orden}`,
  ayuda: null,
  campo: "resumen",
  orden,
  activa: true,
  momento,
});

describe("catálogo de campos", () => {
  it("cada campo tiene tipo y etiqueta", () => {
    expect(Object.keys(TIPO_CAMPO).sort()).toEqual([...CAMPOS_PREGUNTA].sort());
    expect(Object.keys(CAMPO_LABEL).sort()).toEqual([...CAMPOS_PREGUNTA].sort());
  });

  it("coincide con el check de la migración 0038", () => {
    expect([...CAMPOS_PREGUNTA].sort()).toEqual([
      "aliados", "compromisos", "descripcion", "fecha", "hashtags", "lugar",
      "mensajes_clave", "nombre", "objetivo", "publico_estimado", "resultados",
      "resumen", "temas",
    ]);
  });

  it("los básicos y los de ficha no se solapan y suman el total", () => {
    const solapan = (CAMPOS_BASICOS as readonly string[]).filter((c) =>
      (CAMPOS_FICHA as readonly string[]).includes(c),
    );
    expect(solapan).toEqual([]);
    expect(CAMPOS_BASICOS.length + CAMPOS_FICHA.length).toBe(CAMPOS_PREGUNTA.length);
  });

  it("los tipos no textuales son los esperados", () => {
    expect(TIPO_CAMPO.publico_estimado).toBe("numero");
    expect(TIPO_CAMPO.temas).toBe("lista");
    expect(TIPO_CAMPO.hashtags).toBe("lista");
    expect(TIPO_CAMPO.fecha).toBe("fecha");
  });
});

describe("preguntasAplicables", () => {
  const preguntas = [
    pregunta("a", 1, "siempre"),
    pregunta("b", 2, "posterior"),
    pregunta("c", 3, "siempre"),
  ];

  it("con la jornada ya hecha, aplican todas", () => {
    expect(preguntasAplicables(preguntas, true)).toHaveLength(3);
  });

  it("antes de la jornada, oculta lo que solo tiene sentido después", () => {
    const out = preguntasAplicables(preguntas, false);
    expect(out.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("no muta la lista original", () => {
    preguntasAplicables(preguntas, false);
    expect(preguntas).toHaveLength(3);
  });
});

describe("primeraPendiente", () => {
  const preguntas = [pregunta("a", 1), pregunta("b", 2), pregunta("c", 3)];

  it("abre en la primera sin responder", () => {
    expect(primeraPendiente(preguntas, new Set(["a"]))).toBe(1);
    expect(primeraPendiente(preguntas, new Set(["a", "b"]))).toBe(2);
  });

  it("con ninguna respondida abre en la primera", () => {
    expect(primeraPendiente(preguntas, new Set())).toBe(0);
  });

  it("con todas respondidas vuelve al principio", () => {
    expect(primeraPendiente(preguntas, new Set(["a", "b", "c"]))).toBe(0);
  });

  it("salta los huecos: si respondieron la segunda, la pendiente es la primera", () => {
    expect(primeraPendiente(preguntas, new Set(["b"]))).toBe(0);
  });

  it("con lista vacía no revienta", () => {
    expect(primeraPendiente([], new Set())).toBe(0);
  });
});

describe("acotar", () => {
  it("mantiene el índice dentro del rango", () => {
    expect(acotar(5, 3)).toBe(2);
    expect(acotar(-2, 3)).toBe(0);
    expect(acotar(1, 3)).toBe(1);
  });

  it("con lista vacía devuelve 0", () => {
    expect(acotar(4, 0)).toBe(0);
  });
});

describe("normalizarFicha", () => {
  it("deja pasar el texto limpio", () => {
    expect(normalizarFicha({ objetivo: "  Convocar líderes  " })).toEqual({
      objetivo: "Convocar líderes",
    });
  });

  it("descarta los campos vacíos en vez de proponer texto en blanco", () => {
    expect(normalizarFicha({ objetivo: "", resumen: "   ", compromisos: null })).toEqual({});
  });

  it("ignora los campos que no son de la ficha", () => {
    expect(normalizarFicha({ objetivo: "Algo", inventado: "x", otro: 1 })).toEqual({
      objetivo: "Algo",
    });
  });

  it("saca el número de un público escrito con palabras", () => {
    expect(normalizarFicha({ publico_estimado: "unas 300 personas" }).publico_estimado).toBe(300);
    expect(normalizarFicha({ publico_estimado: 250 }).publico_estimado).toBe(250);
    expect(normalizarFicha({ publico_estimado: "1.200" }).publico_estimado).toBe(1200);
  });

  it("descarta un público del que no se puede sacar número", () => {
    expect(normalizarFicha({ publico_estimado: "bastante gente" })).toEqual({});
    expect(normalizarFicha({ publico_estimado: -5 })).toEqual({});
  });

  it("convierte las listas escritas como texto", () => {
    expect(normalizarFicha({ temas: "salud, empleo, seguridad" }).temas).toEqual([
      "salud", "empleo", "seguridad",
    ]);
  });

  it("acepta las listas que ya vienen como arreglo", () => {
    expect(normalizarFicha({ temas: ["salud", "  empleo  ", ""] }).temas).toEqual(["salud", "empleo"]);
  });

  it("normaliza los hashtags con y sin numeral, sin duplicar", () => {
    expect(normalizarFicha({ hashtags: "#Salud, empleo, #salud" }).hashtags).toEqual([
      "#Salud", "#empleo",
    ]);
  });

  it("descarta una lista que queda vacía", () => {
    expect(normalizarFicha({ temas: "  ,  , " })).toEqual({});
    expect(normalizarFicha({ hashtags: [] })).toEqual({});
  });

  it("acepta una fecha en ISO", () => {
    expect(normalizarFicha({ fecha: "2026-06-14" }).fecha).toBe("2026-06-14");
    expect(normalizarFicha({ fecha: "2026-06-14T10:00:00Z" }).fecha).toBe("2026-06-14");
  });

  it("descarta fechas ambiguas o imposibles en vez de adivinar", () => {
    // Una fecha mal interpretada queda como dato oficial del evento.
    expect(normalizarFicha({ fecha: "el catorce de junio" })).toEqual({});
    expect(normalizarFicha({ fecha: "14/06/2026" })).toEqual({});
    expect(normalizarFicha({ fecha: "2026-13-45" })).toEqual({});
    expect(normalizarFicha({ fecha: "2026-02-31" })).toEqual({});
  });

  it("llena también los campos básicos de la creación", () => {
    expect(
      normalizarFicha({ nombre: "Recorrido Kennedy", lugar: "Kennedy", descripcion: "Jornada" }),
    ).toEqual({ nombre: "Recorrido Kennedy", lugar: "Kennedy", descripcion: "Jornada" });
  });

  it("no revienta con entradas absurdas", () => {
    expect(normalizarFicha(null)).toEqual({});
    expect(normalizarFicha(undefined)).toEqual({});
    expect(normalizarFicha("texto")).toEqual({});
    expect(normalizarFicha({ temas: 42 })).toEqual({});
  });
});
