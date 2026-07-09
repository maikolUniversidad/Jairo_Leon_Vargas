"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Sincroniza una pestaña/vista con un parámetro de la URL, para que los
 * submódulos (query param) funcionen igual desde:
 *  - los pills de submódulo en móvil,
 *  - el sidebar de escritorio,
 *  - y los propios controles internos de la página.
 *
 * La URL es la única fuente de verdad, así el resaltado de submódulo y el
 * contenido mostrado nunca se desincronizan.
 *
 * @param key      nombre del query param (p. ej. "tab", "vista", "capa")
 * @param fallback valor por defecto cuando el param no existe o no es válido
 * @param valid    lista opcional de valores permitidos
 */
export function useTabParam<T extends string = string>(
  key: string,
  fallback: T,
  valid?: readonly T[],
): readonly [T, (next: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get(key) as T | null;
  const value: T = raw && (!valid || valid.includes(raw)) ? raw : fallback;

  const setValue = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, next);
      // replace + scroll:false: cambiar de pestaña no ensucia el historial ni
      // salta el scroll; los <Link> de submódulo siguen usando push (navegación).
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [key, pathname, router, searchParams],
  );

  return [value, setValue] as const;
}
