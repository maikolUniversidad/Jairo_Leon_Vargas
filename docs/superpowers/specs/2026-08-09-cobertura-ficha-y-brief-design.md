# Ficha ampliada de cobertura y brief para la IA — Diseño

Fecha: 2026-08-09
Módulo: Comunicaciones → Coberturas
Estado: aprobado por el usuario

## Problema

Una cobertura solo guarda nombre, descripción, fecha y lugar, y esos cuatro campos
únicamente se pueden escribir en el momento de crearla: después de creada, lo único
modificable es el estado. Todo lo que de verdad describe la jornada —para qué se
convocó, qué ocurrió, quién estuvo, qué se prometió— vive fuera de la plataforma.

Como consecuencia, cuando el equipo quiere que el asistente de IA redacte una
publicación tiene que volver a escribirle el contexto entero a mano.

## Alcance

Entra: ficha editable con los campos existentes y los nuevos, registro de asistentes
(vinculados a la plataforma y sueltos), generación del brief y los dos botones que lo
copian o lo llevan al chat.

No entra: una herramienta de coberturas para que el asistente las consulte por su
cuenta. Con el brief ya recibe el contexto completo; una herramienta serviría para
preguntas del tipo «¿qué coberturas hicimos en junio?», que es otro problema.

Permisos: sin cambios, los del módulo Comunicaciones.

## Arquitectura

### Ficha editable

La tarjeta de cabecera gana un modo de edición con todos los campos. Los nuevos se
agrupan en cuatro bloques plegables para que la ficha no abrume cuando solo se quiere
consultar:

| bloque | campos |
|---|---|
| Qué se hizo | `objetivo`, `resumen` |
| Mensaje | `mensajes_clave`, `temas` |
| Cierre | `resultados`, `compromisos` |
| Contexto | `aliados`, `publico_estimado`, `hashtags` |

`mensajes_clave` es texto libre con un mensaje por línea. `temas` y `hashtags` son
listas de etiquetas. El resto es texto libre, salvo `publico_estimado`, que es un
entero.

### Asistentes

Tabla `cobertura_asistentes`. Cada fila apunta a un contacto, a un ciudadano, o a
ninguno de los dos y entonces vale el nombre escrito a mano. Una restricción impide
que una fila quede sin persona y sin nombre.

El `nombre` se guarda siempre, también en los vinculados: si el contacto se borra,
el registro histórico de la cobertura no se queda mudo.

Cada asistente lleva un `rol` opcional —asistente, ponente, organizador, prensa—
porque en un brief no es lo mismo quien habló que quien acompañó.

La interfaz es un buscador único sobre contactos y ciudadanos, más un campo para
añadir nombres libres.

### El brief

`lib/cobertura-brief.ts` expone una función pura que recibe la cobertura, sus
asistentes y sus archivos, y devuelve Markdown. No consulta nada: por eso se prueba
con vitest sin base de datos, y el mismo texto alimenta los dos botones.

Estructura del texto:

1. Una instrucción de encabezado que convierte el volcado en un prompt útil
   («Esta es la información de una cobertura de prensa…»).
2. Los datos de la ficha, omitiendo los campos vacíos.
3. Los presentes, agrupados por rol.
4. El inventario de contenido por fase: cuántas piezas de cada tipo, y las que tengan
   descripción listadas con ella.

El server action `getBriefCobertura(id)` consulta y delega el formato a esa función.

### Los dos botones

«Copiar prompt» lo deja en el portapapeles. «Abrir en el chat IA» navega al asistente
con el texto ya cargado en el compositor.

El chat ya acepta `/dashboard/ia?prompt=…`, pero un brief con nombres de asistentes
puede pasar de varios miles de caracteres, y meterlo en la URL lo expone en el
historial del navegador y en los registros del servidor. Así que el prompt viaja por
`sessionStorage` bajo la clave `ia:prompt` y la URL solo lleva `?prompt=sesion`.
`AsistenteClient` lee esa clave al montar y la borra, para que no reaparezca al
volver al chat más tarde.

## Datos

Migración `0033_cobertura_ficha.sql`.

Sobre `public.coberturas`, todas con default o nulas para no romper filas existentes:

| columna | tipo |
|---|---|
| `objetivo` | `text` |
| `resumen` | `text` |
| `mensajes_clave` | `text` |
| `temas` | `text[] not null default '{}'` |
| `resultados` | `text` |
| `compromisos` | `text` |
| `aliados` | `text` |
| `publico_estimado` | `int` |
| `hashtags` | `text[] not null default '{}'` |

Tabla nueva:

```sql
create table public.cobertura_asistentes (
  id           uuid primary key default gen_random_uuid(),
  cobertura_id uuid not null references public.coberturas(id) on delete cascade,
  contacto_id  uuid references public.contacts(id) on delete set null,
  ciudadano_id uuid references public.citizens(id) on delete set null,
  nombre       text not null,
  rol          text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint cobertura_asistentes_nombre_no_vacio check (length(btrim(nombre)) > 0)
);
```

RLS igual que el resto del módulo: lectura para `is_staff()`, escritura para
`can_manage_comunicaciones()`.

## Componentes

| archivo | responsabilidad |
|---|---|
| `cobertura-ficha-form.tsx` | edición de la ficha, con los bloques plegables |
| `cobertura-asistentes.tsx` | buscador de personas y nombres libres |
| `lib/cobertura-brief.ts` | formateador puro del brief |
| `tests/unit/cobertura-brief.test.ts` | pruebas del formateador |

Acciones nuevas en `actions/coberturas.ts`: `updateCoberturaFicha`, `addAsistente`,
`removeAsistente`, `getBriefCobertura`.

## Errores

- Guardado de la ficha con nombre vacío: error por campo bajo el control, sin toast
  ciego, siguiendo el patrón de `useFieldErrors`.
- Asistente duplicado: se detecta por persona vinculada o por nombre normalizado y se
  avisa en vez de insertar dos veces.
- Portapapeles bloqueado por el navegador: se muestra el texto en un diálogo para
  copiarlo a mano.
- `sessionStorage` no disponible: el botón cae a la URL con el prompt recortado a
  1500 caracteres y avisa de que se recortó.

## Pruebas

El formateador se cubre con vitest: cobertura mínima sin campos opcionales, cobertura
completa, agrupación de asistentes por rol, inventario con y sin descripciones, y
omisión de los campos vacíos.
