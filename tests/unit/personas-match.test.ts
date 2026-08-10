import { describe, expect, it } from "vitest";

import {
  buscarPersona,
  mismoNombre,
  normalizar,
  resolverPersonas,
  type PersonaConocida,
} from "@/lib/personas-match";

const conocidas: PersonaConocida[] = [
  { id: "u1", tipo: "usuario", nombre: "Marta Lucía Ospina Rojas" },
  { id: "u2", tipo: "usuario", nombre: "Diego Castaño" },
  { id: "c1", tipo: "contacto", nombre: "Ana María Pérez" },
  { id: "c2", tipo: "contacto", nombre: "Juan Quintero" },
  { id: "z1", tipo: "ciudadano", nombre: "Juan Quintero" },
];

describe("normalizar", () => {
  it("quita tildes, mayúsculas y puntuación", () => {
    expect(normalizar("  Martá   LUCÍA, Ospina.  ")).toBe("marta lucia ospina");
  });

  it("pliega la ñ a n: Whisper la escribe de las dos formas", () => {
    expect(normalizar("Castaño")).toBe("castano");
  });

  it("con basura devuelve cadena vacía", () => {
    expect(normalizar("   ...  ")).toBe("");
  });
});

describe("mismoNombre", () => {
  it("empareja un nombre corto contenido en el completo", () => {
    expect(mismoNombre("Marta Ospina", "Marta Lucía Ospina Rojas")).toBe(true);
  });

  it("empareja aunque Whisper se coma las tildes o la ñ", () => {
    expect(mismoNombre("Diego Castano", "Diego Castaño")).toBe(true);
    expect(mismoNombre("Ana Maria Perez", "Ana María Pérez")).toBe(true);
  });

  it("es simétrico", () => {
    expect(mismoNombre("Marta Lucía Ospina Rojas", "Marta Ospina")).toBe(true);
  });

  it("NO empareja por el solo nombre de pila", () => {
    // Meter a la persona equivocada en el registro de una jornada es peor que
    // dejarla sin vincular.
    expect(mismoNombre("Marta", "Marta Lucía Ospina Rojas")).toBe(false);
    expect(mismoNombre("Juan", "Juan Quintero")).toBe(false);
  });

  it("no empareja personas distintas que comparten un apellido", () => {
    expect(mismoNombre("Pedro Ospina", "Marta Lucía Ospina Rojas")).toBe(false);
  });

  it("con nombres vacíos devuelve false", () => {
    expect(mismoNombre("", "Marta Ospina")).toBe(false);
    expect(mismoNombre("  ", "  ")).toBe(false);
  });
});

describe("buscarPersona", () => {
  it("encuentra la única coincidencia", () => {
    expect(buscarPersona("Marta Ospina", conocidas)?.id).toBe("u1");
  });

  it("devuelve null si no hay ninguna", () => {
    expect(buscarPersona("Sofía Ramírez", conocidas)).toBeNull();
  });

  it("ante dos personas con el mismo nombre, no adivina", () => {
    // "Juan Quintero" existe como contacto y como ciudadano.
    expect(buscarPersona("Juan Quintero", conocidas)).toBeNull();
  });

  it("con lista vacía devuelve null", () => {
    expect(buscarPersona("Marta Ospina", [])).toBeNull();
  });
});

describe("resolverPersonas", () => {
  it("marca como equipo a quien empareja con un usuario, aunque la IA dijera otra cosa", () => {
    const out = resolverPersonas(
      [{ nombre: "Marta Ospina", vinculo: "aliado" }],
      conocidas,
    );
    expect(out[0]!.vinculo).toBe("equipo");
    expect(out[0]!.match?.id).toBe("u1");
  });

  it("respeta el vínculo cuando no empareja con un usuario", () => {
    const out = resolverPersonas(
      [{ nombre: "Ana María Pérez", vinculo: "aliado", organizacion: "JAC Kennedy" }],
      conocidas,
    );
    expect(out[0]!.vinculo).toBe("aliado");
    expect(out[0]!.match?.tipo).toBe("contacto");
    expect(out[0]!.organizacion).toBe("JAC Kennedy");
  });

  it("deja sin vincular a quien no está en la plataforma, pero lo conserva", () => {
    const out = resolverPersonas([{ nombre: "Sofía Ramírez", vinculo: "aliado" }], conocidas);
    expect(out).toHaveLength(1);
    expect(out[0]!.match).toBeNull();
    expect(out[0]!.nombre).toBe("Sofía Ramírez");
  });

  it("no repite a la misma persona nombrada dos veces", () => {
    const out = resolverPersonas(
      [
        { nombre: "Marta Ospina", vinculo: "equipo" },
        { nombre: "  marta   ospina ", vinculo: "aliado" },
      ],
      conocidas,
    );
    expect(out).toHaveLength(1);
  });

  it("descarta nombres vacíos", () => {
    const out = resolverPersonas(
      [
        { nombre: "   ", vinculo: "otro" },
        { nombre: "...", vinculo: "otro" },
        { nombre: "Diego Castaño", vinculo: "otro" },
      ],
      conocidas,
    );
    expect(out.map((p) => p.nombre)).toEqual(["Diego Castaño"]);
  });

  it("con lista vacía devuelve lista vacía", () => {
    expect(resolverPersonas([], conocidas)).toEqual([]);
  });
});
