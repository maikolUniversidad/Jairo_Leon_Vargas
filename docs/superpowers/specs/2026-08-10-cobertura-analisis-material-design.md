# Análisis automático del material de una cobertura — Diseño

**Fecha:** 2026-08-10
**Módulo:** Comunicaciones → Coberturas
**Estado:** diseño aprobado; implementación en espera de que aterrice
`2026-08-09-cobertura-subida-preview-equipo-design.md`

---

## El problema

El brief que se le pasa a la IA solo sabe de un archivo lo que alguien haya escrito
a mano en su ficha. En la práctica nadie describe 200 fotos, así que el brief dice
«Contenido Crudo: 180 fotos y 12 videos» y nada más. La IA no tiene forma de saber
qué hay en ese material, y por tanto no puede proponer qué hacer con él.

## Qué se construye

Cada archivo se analiza automáticamente al subirse. El resultado —qué se ve, qué
tipo de plano, para qué sirve, y unas etiquetas— se guarda junto al archivo, se
muestra en su ficha y entra en el brief que ya generan los botones existentes.

## Dependencia

Este trabajo se apoya en la migración `0034`, que ya está aplicada y añade
`tipo_contenido` a `cobertura_files`. El análisis **no** vuelve a deducir el tipo
desde el mime: usa esa columna, que además es corregible a mano en la revisión
previa. Si alguien reclasifica un archivo, el análisis correcto es el de su tipo
nuevo.

Por eso la implementación empieza cuando el trabajo de revisión previa y equipos
esté commiteado y el árbol compile.

## Alcance

Entra: análisis de fotos, videos y documentos; almacenamiento por archivo; reintento
manual; y la integración en el brief.

No entra: transcripción de audio (no hay infraestructura y sería otro proveedor),
una herramienta para que el asistente consulte coberturas por su cuenta, y el
análisis lanzado desde el chat. Se decidió que el análisis llega a la IA por el
prompt, que es el camino ya construido.

---

## Arquitectura

### Qué se le manda a la IA según el tipo

Todo se apoya en piezas que ya existen; no hace falta infraestructura nueva.
`OPENAI_API_KEY` está configurada y `gpt-4o-mini` con visión ya está cableado en
`resolveProvider()`.

| `tipo_contenido` | Entrada | Modelo |
|---|---|---|
| `foto` | La miniatura de Drive a 1024 px, vía el proxy `/api/drive/thumb/[fileId]` | `gpt-4o-mini` (visión) |
| `video` | El fotograma que genera Drive, más la duración si está disponible | `gpt-4o-mini` (visión) |
| `documento` | El texto extraído con `extractDocumentText()` de `lib/kb/extract.ts`, recortado a 12 000 caracteres | `deepseek-chat` (no necesita visión) |
| `audio` | — | ninguno: queda en estado `omitido` |
| `otro` | — | ninguno: queda en estado `omitido` |

**Limitación que se declara, no se esconde.** El análisis de un video se hace sobre
un fotograma, no sobre el video entero. El texto guardado lo dice explícitamente y
el brief lo repite, para que ni el equipo ni la IA supongan que alguien vio el clip
completo.

### Qué devuelve el análisis

El modelo responde en JSON con tres campos:

- `resumen`: dos o tres frases sobre qué se ve o qué dice el documento.
- `utilidad`: para qué sirve la pieza (por ejemplo «sirve de portada», «plano de
  apoyo», «no es publicable, está movida»). Esto es lo que permite a la IA proponer
  qué hacer con el material.
- `etiquetas`: entre tres y seis, en minúscula.

El prompt del sistema le prohíbe explícitamente **identificar personas por nombre**
y le pide describir por rol o apariencia genérica. Es material de ciudadanos y no
corresponde que un modelo les ponga nombre.

### Cuándo se ejecuta

Automático al terminar cada subida, pero procesado por una cola en el cliente con
concurrencia 2, igual que la de subida y por la misma razón: cada análisis es una
llamada a un server action que tarda segundos, y así el tablero sigue usable.

Dos detalles que la implementación no puede pasar por alto:

1. **Drive tarda en generar la miniatura.** Si el proxy responde 404, el análisis no
   falla: se reintenta a los 15 segundos y, si vuelve a fallar, queda en `pendiente`
   para el botón manual.
2. **Coste.** Cada foto es una llamada con visión. Un levantamiento de 200 fotos son
   200 llamadas. La cola se salta los archivos ya analizados, y el tablero muestra un
   botón «Analizar N pendientes» para relanzar solo lo que falta. Conviene decidir
   más adelante si esto necesita un tope por cobertura.

### El brief

`construirBrief()` cambia en tres puntos:

1. Hoy lista solo los archivos con `descripcion`. Pasa a listar los que tengan
   descripción **o** análisis, mostrando ambos cuando existan. La descripción escrita
   a mano va primero: si alguien se tomó el trabajo de escribirla, manda sobre la
   automática.
2. Se agregan las etiquetas de todo el material en una línea de «temas detectados en
   el material», para que la IA vea de un vistazo de qué va el levantamiento.
3. El encabezado advierte que los análisis son automáticos y pueden equivocarse, y
   que los de video se basan en un fotograma.

Como `construirBrief()` es una función pura con pruebas, estos cambios se cubren
ampliando `tests/unit/cobertura-brief.test.ts`.

---

## Datos

Migración `0035_cobertura_analisis.sql`, sobre `public.cobertura_files`:

| columna | tipo | propósito |
|---|---|---|
| `analisis` | `text` | el resumen y la utilidad, ya redactados |
| `analisis_etiquetas` | `text[] not null default '{}'` | etiquetas detectadas |
| `analisis_estado` | `text not null default 'pendiente'` | `pendiente`, `listo`, `error`, `omitido` |
| `analisis_error` | `text` | motivo del fallo, para que el reintento sea informado |
| `analisis_modelo` | `text` | con qué modelo se hizo |
| `analisis_at` | `timestamptz` | cuándo |

Con un check sobre `analisis_estado` y un índice parcial por
`(cobertura_id, analisis_estado)` donde el estado no es `listo`, que es justo lo que
consulta el botón de pendientes.

Sin tabla aparte: no hace falta historial de análisis, y tenerlo en la misma fila
evita un join en la consulta del brief, que es la ruta caliente.

---

## Componentes

| archivo | responsabilidad |
|---|---|
| `lib/ia/analizarMaterial.ts` | arma el prompt por tipo, llama al proveedor y valida el JSON |
| `actions/analisis.ts` | `analizarArchivo(fileId)` y `analizarPendientes(coberturaId)` |
| `hooks/use-analisis-queue.ts` | cola en el cliente, concurrencia 2, reintento |
| `lib/cobertura-brief.ts` | cambios en el formateador |
| `cobertura-file-dialog.tsx` | muestra el análisis y ofrece relanzarlo |
| `cobertura-board.tsx` | contador y botón «Analizar N pendientes» |

`lib/ia/analizarMaterial.ts` recibe la entrada ya resuelta (bytes de la miniatura o
texto del documento) y no consulta la base: así se prueba con un proveedor simulado.

---

## Errores

- Miniatura no lista: reintento a los 15 s, luego `pendiente`.
- Documento sin texto extraíble (un PDF escaneado): estado `omitido` con el motivo,
  no `error`. No hay nada que arreglar reintentando.
- El modelo no devuelve JSON válido: un reintento con la instrucción de formato
  reforzada; si vuelve a fallar, `error` con el texto crudo en `analisis_error`.
- Falta la llave del proveedor: `error` con un mensaje que dice qué configurar, no
  un fallo genérico.
- Archivo borrado de Drive por fuera: `error`, y la tarjeta ya lo marca como no
  disponible.

---

## Lo que hay que decidir antes de publicar

Este análisis manda fotos de ciudadanos a un proveedor externo (OpenAI). El
proyecto tiene una página de política de datos y maneja información de personas
atendidas por una UTL. Antes de activar esto en producción conviene confirmar que
ese tratamiento está cubierto, o restringir el análisis automático a las fases
`editado` y `aprobado`, donde el material ya pasó por criterio humano.

Se deja señalado aquí a propósito: es una decisión del responsable de los datos, no
del diseño técnico.
