import { describe, expect, it } from "vitest";

import { formatBytes, mediaKind, tieneMiniatura } from "@/lib/media-kind";

// mediaKind decide el ícono de la tarjeta y cómo la abre el visor. El material
// que sube el equipo de campo llega muchas veces sin mime (cámaras, Drive),
// así que la caída a la extensión tiene que funcionar.

describe("mediaKind", () => {
  it("el mime manda por encima de la extensión", () => {
    expect(mediaKind("video/mp4", "cosa.jpg")).toBe("video");
    expect(mediaKind("image/png", "cosa.mp4")).toBe("imagen");
    expect(mediaKind("audio/mpeg", "cosa.pdf")).toBe("audio");
    expect(mediaKind("application/pdf", "cosa.png")).toBe("pdf");
  });

  it("cae a la extensión cuando no hay mime", () => {
    expect(mediaKind(null, "foto.JPG")).toBe("imagen");
    expect(mediaKind("", "clip.MOV")).toBe("video");
    expect(mediaKind(undefined, "audio.m4a")).toBe("audio");
    expect(mediaKind(null, "informe.pdf")).toBe("pdf");
    expect(mediaKind(null, "planilla.xlsx")).toBe("documento");
  });

  it("reconoce los formatos crudos de cámara", () => {
    for (const ext of ["cr2", "nef", "arw", "dng", "raw"]) {
      expect(mediaKind(null, `DSC_0001.${ext}`), ext).toBe("imagen");
    }
  });

  it("clasifica por familia de mime cuando la extensión no dice nada", () => {
    expect(mediaKind("application/msword", "sin-extension")).toBe("documento");
    expect(mediaKind("application/vnd.ms-excel-sheet", "x")).toBe("documento");
    expect(mediaKind("text/plain", "notas")).toBe("documento");
  });

  it("lo que no reconoce cae en `archivo`, nunca revienta", () => {
    expect(mediaKind(null, "respaldo.zip")).toBe("archivo");
    expect(mediaKind(null, "sinextension")).toBe("archivo");
    expect(mediaKind("", "")).toBe("archivo");
    expect(mediaKind("application/octet-stream", "raro.xyz")).toBe("archivo");
  });

  it("no se confunde con nombres que tienen varios puntos", () => {
    expect(mediaKind(null, "acta.final.v2.pdf")).toBe("pdf");
  });
});

describe("tieneMiniatura", () => {
  it("solo los tipos que Drive previsualiza", () => {
    expect(tieneMiniatura("imagen")).toBe(true);
    expect(tieneMiniatura("video")).toBe(true);
    expect(tieneMiniatura("pdf")).toBe(true);
    expect(tieneMiniatura("documento")).toBe(true);
    expect(tieneMiniatura("audio")).toBe(false);
    expect(tieneMiniatura("archivo")).toBe(false);
  });
});

describe("formatBytes", () => {
  it("usa la unidad adecuada", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 MB");
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
  });

  it("redondea sin decimales a partir de 10", () => {
    expect(formatBytes(1024 * 15)).toBe("15 KB");
  });

  it("muestra guion cuando no hay tamaño", () => {
    expect(formatBytes(0)).toBe("—");
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(undefined)).toBe("—");
    expect(formatBytes(-5)).toBe("—");
  });
});
