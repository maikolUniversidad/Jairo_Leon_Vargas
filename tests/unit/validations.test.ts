import { describe, expect, it } from "vitest";

import {
  EMAIL_RE,
  LOCALIDADES,
  REQUEST_CATEGORIES,
  REQUEST_CATEGORY_LABELS,
  citizenRegisterSchema,
  citizenRequestSchema,
  contactSchema,
  loginSchema,
  looksLikeEmail,
  newUserSchema,
  phoneDigits,
  profileSchema,
  publicSolicitudSchema,
  taskSchema,
} from "@/lib/validations";

/** Devuelve el mapa campo → primer mensaje, como lo consumen los formularios. */
function erroresPorCampo(result: { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } }) {
  if (result.success || !result.error) return {};
  const out: Record<string, string> = {};
  for (const i of result.error.issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

describe("helpers de contacto", () => {
  it("looksLikeEmail avisa, no bloquea: acepta lo razonable", () => {
    expect(looksLikeEmail("hola@ejemplo.com")).toBe(true);
    expect(looksLikeEmail("  hola@ejemplo.com  ")).toBe(true);
    expect(looksLikeEmail("hola+etiqueta@sub.ejemplo.co")).toBe(true);
  });

  it("looksLikeEmail rechaza lo que claramente no es correo", () => {
    expect(looksLikeEmail("hola")).toBe(false);
    expect(looksLikeEmail("hola@")).toBe(false);
    expect(looksLikeEmail("hola@ejemplo")).toBe(false);
    expect(looksLikeEmail("a b@ejemplo.com")).toBe(false);
    expect(looksLikeEmail("")).toBe(false);
  });

  it("EMAIL_RE no tiene el flag global (si no, test() alterna entre llamadas)", () => {
    expect(EMAIL_RE.global).toBe(false);
    expect(EMAIL_RE.test("a@b.co")).toBe(true);
    expect(EMAIL_RE.test("a@b.co")).toBe(true);
  });

  it("phoneDigits deja solo dígitos", () => {
    expect(phoneDigits("+57 (300) 123-4567")).toBe("573001234567");
    expect(phoneDigits("sin números")).toBe("");
    expect(phoneDigits(null)).toBe("");
    expect(phoneDigits(undefined)).toBe("");
  });
});

describe("catálogos", () => {
  it("las localidades de Bogotá no se repiten e incluyen la salida `Otra`", () => {
    expect(new Set(LOCALIDADES).size).toBe(LOCALIDADES.length);
    expect(LOCALIDADES).toContain("Otra");
    expect(LOCALIDADES).toContain("San Cristóbal");
  });

  it("cada categoría de solicitud tiene etiqueta", () => {
    for (const c of REQUEST_CATEGORIES) {
      expect(REQUEST_CATEGORY_LABELS[c], `falta etiqueta de ${c}`).toBeTruthy();
    }
    expect(Object.keys(REQUEST_CATEGORY_LABELS).sort()).toEqual([...REQUEST_CATEGORIES].sort());
  });
});

describe("consentimiento de datos (Ley 1581)", () => {
  const base = {
    nombre: "Ana",
    tipo_solicitud: "servicio" as const,
    asunto: "Necesito ayuda",
    descripcion: "Descripción suficientemente larga para pasar.",
  };

  it("sin autorización el formulario no pasa, y el error cae en su campo", () => {
    const r = citizenRequestSchema.safeParse({ ...base, consentimiento_datos: false });
    expect(r.success).toBe(false);
    expect(erroresPorCampo(r).consentimiento_datos).toMatch(/autorizar/i);
  });

  it("con autorización pasa", () => {
    expect(citizenRequestSchema.safeParse({ ...base, consentimiento_datos: true }).success).toBe(true);
  });

  it("también se exige en el registro ciudadano", () => {
    const r = citizenRegisterSchema.safeParse({ nombre: "Ana", consentimiento_datos: false });
    expect(erroresPorCampo(r).consentimiento_datos).toMatch(/autorizar/i);
  });
});

describe("formularios públicos", () => {
  it("el registro acepta lo mínimo: nombre + consentimiento", () => {
    expect(citizenRegisterSchema.safeParse({ nombre: "Ana", consentimiento_datos: true }).success).toBe(true);
  });

  it("acepta los campos opcionales en blanco sin quejarse", () => {
    const r = citizenRegisterSchema.safeParse({
      nombre: "Ana",
      apellido: "",
      email: "",
      telefono: "",
      whatsapp: "",
      barrio: "",
      consentimiento_datos: true,
    });
    expect(r.success).toBe(true);
  });

  it("un correo mal escrito falla en el campo `email`, no en un toast genérico", () => {
    const r = citizenRegisterSchema.safeParse({
      nombre: "Ana",
      email: "no-es-correo",
      consentimiento_datos: true,
    });
    expect(erroresPorCampo(r)).toEqual({ email: "Correo inválido" });
  });

  it("un teléfono con letras falla en el campo `telefono`", () => {
    const r = citizenRegisterSchema.safeParse({
      nombre: "Ana",
      telefono: "abc-def",
      consentimiento_datos: true,
    });
    expect(erroresPorCampo(r)).toEqual({ telefono: "Teléfono inválido" });
  });

  it("acumula un error por cada campo malo, no solo el primero", () => {
    const r = citizenRequestSchema.safeParse({
      nombre: "A",
      tipo_solicitud: "servicio",
      asunto: "ab",
      descripcion: "corto",
      consentimiento_datos: true,
    });
    const e = erroresPorCampo(r);
    expect(Object.keys(e).sort()).toEqual(["asunto", "descripcion", "nombre"]);
  });

  it("rechaza una localidad que no existe", () => {
    const r = citizenRegisterSchema.safeParse({
      nombre: "Ana",
      localidad: "Medellín",
      consentimiento_datos: true,
    });
    expect(r.success).toBe(false);
  });
});

describe("solicitud pública (radicación)", () => {
  const base = {
    categoria: REQUEST_CATEGORIES[0],
    nombre: "Ana Pérez",
    descripcion: "Una descripción con largo suficiente.",
    consentimiento_datos: true,
  };

  it("pasa con lo mínimo", () => {
    expect(publicSolicitudSchema.safeParse(base).success).toBe(true);
  });

  it("convierte la edad escrita como texto a número", () => {
    const r = publicSolicitudSchema.safeParse({ ...base, edad: "42" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.edad).toBe(42);
  });

  it("acepta la edad vacía (el formulario no siempre la pide)", () => {
    expect(publicSolicitudSchema.safeParse({ ...base, edad: "" }).success).toBe(true);
  });

  it("rechaza edades imposibles", () => {
    expect(publicSolicitudSchema.safeParse({ ...base, edad: 200 }).success).toBe(false);
    expect(publicSolicitudSchema.safeParse({ ...base, edad: -1 }).success).toBe(false);
  });

  it("exige elegir categoría con un mensaje entendible", () => {
    const r = publicSolicitudSchema.safeParse({ ...base, categoria: undefined });
    expect(erroresPorCampo(r).categoria).toMatch(/Selecciona/i);
  });
});

describe("contacto (CRM)", () => {
  it("un correo raro NO impide guardar: se avisa en la UI, no se bloquea", () => {
    const r = contactSchema.safeParse({ nombre: "Ana", email: "esto-no-es-correo" });
    expect(r.success).toBe(true);
    expect(looksLikeEmail("esto-no-es-correo")).toBe(false);
  });

  it("aplica `aliado` como tipo por defecto", () => {
    const r = contactSchema.safeParse({ nombre: "Ana" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tipo).toBe("aliado");
  });

  it("exige un nombre de al menos 2 caracteres", () => {
    expect(erroresPorCampo(contactSchema.safeParse({ nombre: "A" })).nombre).toBe("Nombre requerido");
  });

  it("acepta zona_id vacío pero rechaza un uuid inventado", () => {
    expect(contactSchema.safeParse({ nombre: "Ana", zona_id: "" }).success).toBe(true);
    expect(contactSchema.safeParse({ nombre: "Ana", zona_id: "no-uuid" }).success).toBe(false);
  });
});

describe("tarea", () => {
  it("aplica los valores por defecto de prioridad, estado y contexto", () => {
    const r = taskSchema.safeParse({ titulo: "Revisar informe" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.prioridad).toBe("media");
      expect(r.data.estado).toBe("pendiente");
      expect(r.data.contexto_operativo).toBe("interno");
      expect(r.data.responsables).toEqual([]);
    }
  });

  it("exige título de al menos 3 caracteres", () => {
    expect(erroresPorCampo(taskSchema.safeParse({ titulo: "ab" })).titulo).toBe("Título requerido");
  });

  it("rechaza estados que no existen en el enum de la base", () => {
    expect(taskSchema.safeParse({ titulo: "Tarea", estado: "archivada" }).success).toBe(false);
  });
});

describe("acceso y alta de usuarios", () => {
  it("login exige correo válido y 6 caracteres de contraseña", () => {
    const e = erroresPorCampo(loginSchema.safeParse({ email: "malo", password: "123" }));
    expect(e.email).toBe("Correo inválido");
    expect(e.password).toMatch(/6 caracteres/);
  });

  it("el alta de usuario exige rol: sin él, el dashboard queda vacío", () => {
    const e = erroresPorCampo(
      newUserSchema.safeParse({ email: "a@b.co", password: "secreto", full_name: "Ana", role_key: "" }),
    );
    expect(e.role_key).toMatch(/Selecciona un rol/i);
  });

  it("el alta pasa cuando está completa", () => {
    const r = newUserSchema.safeParse({
      email: "ana@utl360.local",
      password: "secreto",
      full_name: "Ana Pérez",
      role_key: "atencion_ciudadana",
    });
    expect(r.success).toBe(true);
  });

  it("el perfil exige nombre pero deja el resto en blanco", () => {
    expect(profileSchema.safeParse({ full_name: "Ana Pérez" }).success).toBe(true);
    expect(erroresPorCampo(profileSchema.safeParse({ full_name: "A" })).full_name).toMatch(/requerido/i);
  });
});
