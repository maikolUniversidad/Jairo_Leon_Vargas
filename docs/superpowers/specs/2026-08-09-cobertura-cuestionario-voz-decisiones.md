# Cuestionario por voz para la ficha de cobertura — decisiones previas

**Fecha:** 2026-08-09
**Estado:** NO es un spec. Son las decisiones ya tomadas, guardadas para no
perderlas. El spec completo se escribe cuando se retome la función.

---

## La idea

Al subir el material de una cobertura, quien estuvo en campo graba respuestas
habladas a una serie de preguntas sobre el evento. El sistema transcribe, extrae
la información y llena la ficha de la cobertura. Las preguntas se recorren como un
carrusel —adelante y atrás, con scroll— mostrando cuáles ya se respondieron, para
que no se quede nada sin contestar.

**Por qué existe:** la ficha ampliada (`0033_cobertura_ficha.sql`) tiene nueve
campos de texto. Nadie los llena escribiendo después de un día de calle. Hablando
sí.

## Decisiones tomadas

| Decisión | Elegido | Razón |
|---|---|---|
| **Orden respecto a la subida con preview** | Spec aparte, va después | Son funciones independientes. Meterlas juntas retrasa las dos |
| **Origen de las preguntas** | Una por campo de la ficha, configurable en Configuración | Cada respuesta sabe exactamente qué campo llena. Preguntas generadas por IA harían que cada cobertura preguntara cosas distintas y no se pudieran comparar eventos |
| **Qué pasa con el audio** | Se conserva como archivo de la cobertura, etiqueta `audio` | Respaldo si la transcripción se equivoca, y registro de lo que dijo el equipo en campo |
| **Confirmación de lo extraído** | Se revisa todo al final, editable, antes de guardar | Una sola revisión sin romper el ritmo del carrusel. Nada entra a la base sin que un humano lo haya visto |

## Decisiones técnicas ya evaluadas

**Transcripción: OpenAI Whisper.** El proyecto ya tiene `OPENAI_API_KEY`. Rinde
notablemente mejor que la Web Speech API del navegador en español colombiano con
ruido de fondo, que es la condición real de uso. Cuesta ~US$0.006 por minuto: una
cobertura con diez respuestas de treinta segundos sale en menos de un centavo.

**Extracción: el `provider.ts` que ya existe**, con salida estructurada contra los
campos de `0033`: `objetivo`, `resumen`, `mensajes_clave`, `temas[]`, `resultados`,
`compromisos`, `aliados`, `publico_estimado`, `hashtags[]`.

**Captura: `MediaRecorder`.** Necesita HTTPS —resuelto en Vercel— y permiso de
micrófono. Hay que contemplar que lo nieguen y ofrecer el camino escrito.

## Lo que falta decidir antes de escribir el spec

- Dónde vive el estado de las respuestas: ¿tabla `cobertura_respuestas` con una
  fila por pregunta, o un `jsonb` en `coberturas`?
- ¿El carrusel es obligatorio al subir, o se puede posponer y retomar después?
- ¿Qué pasa si una cobertura ya tiene la ficha llena a mano y luego alguien graba?
  ¿Sobrescribe, propone, o se bloquea?
- Comportamiento sin señal: ¿se graba en local y se transcribe al reconectar?
- Idioma y muletillas: el material de campo va a traer ruido, gente hablando
  encima y frases a medias. Hay que definir qué tan agresiva es la limpieza.

## Dependencias

- `0033_cobertura_ficha.sql` aplicada (los campos que se llenan).
- Etiqueta `audio` en `cobertura_files`, que entra con el spec de la subida con
  preview (`2026-08-09-cobertura-subida-preview-equipo-design.md`).
