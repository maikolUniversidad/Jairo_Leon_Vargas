import { describe, expect, it } from "vitest";

import { dispositivoDeImagen, dispositivoDeVideo, unirMarcaModelo } from "@/lib/exif";
import {
  jpegConExif,
  jpegSinExif,
  mp4ConDispositivo,
  mp4ConDispositivoEnIlst,
  mp4SinDispositivo,
} from "../helpers/media-fixtures";

describe("unirMarcaModelo", () => {
  it("une marca y modelo", () => {
    expect(unirMarcaModelo("SONY", "ILCE-7M3")).toBe("SONY ILCE-7M3");
    expect(unirMarcaModelo("Apple", "iPhone 15 Pro")).toBe("Apple iPhone 15 Pro");
  });

  it("no duplica cuando el modelo ya trae la marca", () => {
    expect(unirMarcaModelo("Canon", "Canon EOS R5")).toBe("Canon EOS R5");
    expect(unirMarcaModelo("NIKON CORPORATION", "NIKON D850")).toBe("NIKON CORPORATION NIKON D850");
  });

  it("compara sin distinguir mayúsculas al detectar el duplicado", () => {
    expect(unirMarcaModelo("canon", "Canon EOS R5")).toBe("Canon EOS R5");
  });

  it("funciona con uno solo de los dos", () => {
    expect(unirMarcaModelo("SONY", null)).toBe("SONY");
    expect(unirMarcaModelo(null, "ILCE-7M3")).toBe("ILCE-7M3");
  });

  it("recorta espacios sobrantes", () => {
    expect(unirMarcaModelo("  SONY  ", "  ILCE-7M3  ")).toBe("SONY ILCE-7M3");
  });

  it("devuelve null cuando no hay nada útil", () => {
    expect(unirMarcaModelo(null, null)).toBeNull();
    expect(unirMarcaModelo("  ", "")).toBeNull();
  });
});

describe("dispositivoDeImagen", () => {
  it("lee Make y Model del EXIF", async () => {
    await expect(dispositivoDeImagen(jpegConExif("SONY", "ILCE-7M3"))).resolves.toBe("SONY ILCE-7M3");
  });

  it("lee un modelo con espacios", async () => {
    await expect(dispositivoDeImagen(jpegConExif("Apple", "iPhone 15 Pro"))).resolves.toBe(
      "Apple iPhone 15 Pro",
    );
  });

  it("devuelve null con un JPEG sin EXIF", async () => {
    await expect(dispositivoDeImagen(jpegSinExif())).resolves.toBeNull();
  });

  it("devuelve null con un buffer que no es imagen, sin lanzar", async () => {
    await expect(dispositivoDeImagen(new Uint8Array([1, 2, 3, 4]))).resolves.toBeNull();
  });

  it("devuelve null con un buffer vacío", async () => {
    await expect(dispositivoDeImagen(new Uint8Array(0))).resolves.toBeNull();
  });
});

describe("dispositivoDeVideo", () => {
  it("lee los átomos ©mak y ©mod de moov/udta", () => {
    expect(dispositivoDeVideo(mp4ConDispositivo("Apple", "iPhone 15 Pro"))).toBe("Apple iPhone 15 Pro");
  });

  it("funciona con solo el modelo", () => {
    expect(dispositivoDeVideo(mp4ConDispositivo(null, "HERO11 Black"))).toBe("HERO11 Black");
  });

  it("funciona con solo la marca", () => {
    expect(dispositivoDeVideo(mp4ConDispositivo("Sony", null))).toBe("Sony");
  });

  it("también lee la variante moov/meta/ilst/©mod/data", () => {
    expect(dispositivoDeVideo(mp4ConDispositivoEnIlst("iPhone 14"))).toBe("iPhone 14");
  });

  it("devuelve null cuando la cámara no escribió el dato", () => {
    expect(dispositivoDeVideo(mp4SinDispositivo())).toBeNull();
  });

  it("devuelve null con basura, sin lanzar ni colgarse", () => {
    expect(dispositivoDeVideo(new Uint8Array(64).fill(0xff))).toBeNull();
    expect(dispositivoDeVideo(new Uint8Array(0))).toBeNull();
    expect(dispositivoDeVideo(new Uint8Array([0, 0, 0, 3, 1, 2, 3]))).toBeNull();
  });

  it("termina aunque el tamaño de un átomo sea incoherente", () => {
    // Tamaño declarado (999) mayor que el buffer: debe cortar, no desbordarse.
    const malo = new Uint8Array(16);
    new DataView(malo.buffer).setUint32(0, 999);
    malo.set(new TextEncoder().encode("moov"), 4);
    expect(dispositivoDeVideo(malo)).toBeNull();
  });
});
