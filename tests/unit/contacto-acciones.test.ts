import { describe, expect, it } from "vitest";

import {
  mailtoUrl,
  redSocialUrl,
  sitioWebUrl,
  telUrl,
  whatsappNumero,
  whatsappUrl,
} from "@/lib/contacto-acciones";

// Estas funciones deciden si aparece o no el botón de contacto en la ficha.
// Un falso positivo abre WhatsApp con un número inexistente; un falso negativo
// esconde el botón de un contacto que sí se podía llamar.

describe("whatsappNumero", () => {
  it("antepone el indicativo 57 a los celulares nacionales de 10 dígitos", () => {
    expect(whatsappNumero("3001234567")).toBe("573001234567");
    expect(whatsappNumero("300 123 4567")).toBe("573001234567");
  });

  it("antepone el 57 a los fijos de 10 dígitos (60x), que si no wa.me lee como Malasia", () => {
    expect(whatsappNumero("6015550000")).toBe("576015550000");
  });

  it("respeta el indicativo cuando el número viene con +", () => {
    expect(whatsappNumero("+57 300 1234567")).toBe("573001234567");
    expect(whatsappNumero("+1 (415) 555-0000")).toBe("14155550000");
  });

  it("no duplica el 57 si ya viene delante de un número nacional", () => {
    expect(whatsappNumero("573001234567")).toBe("573001234567");
  });

  it("descarta los fijos sin indicativo de ciudad: no se puede reconstruir", () => {
    expect(whatsappNumero("5550000")).toBeNull();
    expect(whatsappNumero("2 555 0000")).toBeNull();
  });

  it("descarta lo que no alcanza a ser un número", () => {
    expect(whatsappNumero("")).toBeNull();
    expect(whatsappNumero(null)).toBeNull();
    expect(whatsappNumero(undefined)).toBeNull();
    expect(whatsappNumero("no tiene")).toBeNull();
    expect(whatsappNumero("12345")).toBeNull();
  });

  it("deja pasar longitudes internacionales sin + asumiéndolas ya completas", () => {
    expect(whatsappNumero("4915112345678")).toBe("4915112345678");
  });
});

describe("whatsappUrl", () => {
  it("construye el enlace de wa.me", () => {
    expect(whatsappUrl("3001234567")).toBe("https://wa.me/573001234567");
  });

  it("codifica el mensaje precargado", () => {
    expect(whatsappUrl("3001234567", "Hola, ¿cómo va?")).toBe(
      "https://wa.me/573001234567?text=Hola%2C%20%C2%BFc%C3%B3mo%20va%3F",
    );
  });

  it("devuelve null si el número no sirve, para no pintar el botón", () => {
    expect(whatsappUrl("123")).toBeNull();
  });
});

describe("telUrl", () => {
  it("marca con los dígitos limpios", () => {
    expect(telUrl("(601) 555-0000")).toBe("tel:6015550000");
  });

  it("conserva el + de los internacionales", () => {
    expect(telUrl("+57 300 1234567")).toBe("tel:+573001234567");
  });

  it("acepta fijos de 7 dígitos, que sí se pueden marcar aunque no sirvan para WhatsApp", () => {
    expect(telUrl("5550000")).toBe("tel:5550000");
    expect(whatsappNumero("5550000")).toBeNull();
  });

  it("rechaza lo que no es marcable", () => {
    expect(telUrl("12345")).toBeNull();
    expect(telUrl(null)).toBeNull();
  });
});

describe("mailtoUrl", () => {
  it("arma el mailto simple", () => {
    expect(mailtoUrl("hola@ejemplo.com")).toBe("mailto:hola@ejemplo.com");
  });

  it("agrega asunto y cuerpo codificados", () => {
    const url = mailtoUrl("hola@ejemplo.com", { asunto: "Reunión", cuerpo: "Buenos días" });
    expect(url).toContain("mailto:hola@ejemplo.com?");
    expect(url).toContain("subject=Reuni%C3%B3n");
    expect(url).toContain("body=Buenos+d%C3%ADas");
  });

  it("rechaza correos que no lo parecen", () => {
    expect(mailtoUrl("sin-arroba")).toBeNull();
    expect(mailtoUrl("a@b")).toBeNull();
    expect(mailtoUrl("")).toBeNull();
    expect(mailtoUrl(null)).toBeNull();
  });
});

describe("redSocialUrl", () => {
  it("acepta usuario con y sin arroba", () => {
    expect(redSocialUrl("instagram", "@jairo")).toBe("https://instagram.com/jairo");
    expect(redSocialUrl("instagram", "jairo")).toBe("https://instagram.com/jairo");
  });

  it("respeta una URL completa tal cual la escribieron", () => {
    expect(redSocialUrl("facebook", "https://facebook.com/perfil")).toBe(
      "https://facebook.com/perfil",
    );
  });

  it("usa el prefijo @ que exige TikTok", () => {
    expect(redSocialUrl("tiktok", "jairo")).toBe("https://tiktok.com/@jairo");
  });

  it("manda x_twitter a x.com", () => {
    expect(redSocialUrl("x_twitter", "@jairo")).toBe("https://x.com/jairo");
  });

  it("devuelve null si solo hay un arroba suelto o está vacío", () => {
    expect(redSocialUrl("instagram", "@")).toBeNull();
    expect(redSocialUrl("instagram", "  ")).toBeNull();
    expect(redSocialUrl("instagram", null)).toBeNull();
  });
});

describe("sitioWebUrl", () => {
  it("completa el protocolo cuando falta", () => {
    expect(sitioWebUrl("ejemplo.com")).toBe("https://ejemplo.com");
  });

  it("no toca las que ya lo traen", () => {
    expect(sitioWebUrl("http://ejemplo.com")).toBe("http://ejemplo.com");
    expect(sitioWebUrl("https://ejemplo.com")).toBe("https://ejemplo.com");
  });

  it("devuelve null si está vacío", () => {
    expect(sitioWebUrl("   ")).toBeNull();
    expect(sitioWebUrl(null)).toBeNull();
  });
});
