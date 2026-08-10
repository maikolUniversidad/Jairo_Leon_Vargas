import { describe, expect, it } from "vitest";

import {
  TIPOS_CONTENIDO,
  TIPO_CONTENIDO_LABEL,
  mediaKind,
  tipoContenido,
  type MediaKind,
  type TipoContenido,
} from "@/lib/media-kind";

const KINDS: MediaKind[] = ["imagen", "video", "audio", "pdf", "documento", "archivo"];

describe("tipoContenido", () => {
  it("mapea los seis valores de mediaKind a las cinco etiquetas", () => {
    expect(tipoContenido("imagen")).toBe("foto");
    expect(tipoContenido("video")).toBe("video");
    expect(tipoContenido("audio")).toBe("audio");
    expect(tipoContenido("pdf")).toBe("documento");
    expect(tipoContenido("documento")).toBe("documento");
    expect(tipoContenido("archivo")).toBe("otro");
  });

  it("todo valor devuelto está en TIPOS_CONTENIDO", () => {
    for (const k of KINDS) {
      expect(TIPOS_CONTENIDO).toContain(tipoContenido(k) as TipoContenido);
    }
  });

  it("cubre los seis kinds, sin dejar ninguno sin mapear", () => {
    for (const k of KINDS) {
      expect(tipoContenido(k), `${k} quedó sin mapear`).toBeTruthy();
    }
  });
});

describe("catálogo de tipos", () => {
  it("coincide exactamente con el check de la migración 0034", () => {
    // cobertura_files_tipo_contenido_check: ('foto','video','audio','documento','otro')
    expect([...TIPOS_CONTENIDO].sort()).toEqual(["audio", "documento", "foto", "otro", "video"]);
  });

  it("cada tipo tiene etiqueta legible", () => {
    expect(Object.keys(TIPO_CONTENIDO_LABEL).sort()).toEqual([...TIPOS_CONTENIDO].sort());
    for (const t of TIPOS_CONTENIDO) expect(TIPO_CONTENIDO_LABEL[t]).toBeTruthy();
  });

  it("no hay tipos repetidos", () => {
    expect(new Set(TIPOS_CONTENIDO).size).toBe(TIPOS_CONTENIDO.length);
  });
});

describe("de archivo a etiqueta, de punta a punta", () => {
  it("clasifica material real de campo", () => {
    const casos: [string | null, string, TipoContenido][] = [
      ["image/jpeg", "DSC_0001.JPG", "foto"],
      [null, "DSC_0001.CR2", "foto"],
      ["video/mp4", "clip.mp4", "video"],
      [null, "entrevista.MOV", "video"],
      ["audio/mpeg", "cuña.mp3", "audio"],
      [null, "ambiente.m4a", "audio"],
      ["application/pdf", "acta.pdf", "documento"],
      [null, "planilla.xlsx", "documento"],
      [null, "respaldo.zip", "otro"],
      ["", "", "otro"],
    ];
    for (const [mime, nombre, esperado] of casos) {
      expect(tipoContenido(mediaKind(mime, nombre)), `${nombre} (${mime})`).toBe(esperado);
    }
  });
});
