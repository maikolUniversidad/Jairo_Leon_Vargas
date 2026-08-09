# QA y despliegue · UTL 360

Cómo comprobamos que la plataforma está bien **antes** de mandarla a producción.

Un solo comando decide:

```bash
npm run preflight
```

🟢 verde → despliega. 🔴 rojo → no despliegas. Así de simple.

---

## 1. La lógica: cinco capas, de barata a cara

Cada capa atrapa una clase de error distinta. No se sustituyen entre sí: una prueba
unitaria jamás va a notar que a una tabla le falta RLS, y el QA de base de datos
jamás va a notar que `whatsappNumero` le pone el indicativo equivocado a un fijo.

| # | Capa | Qué atrapa | Comando | Tarda |
|---|------|-----------|---------|-------|
| 1 | **Tipos** | Campos que no existen, `null` sin manejar, firmas cambiadas | `npm run typecheck` | ~10 s |
| 2 | **Lint** | Reglas de React/Next que rompen el render o el build | `npm run lint` | ~10 s |
| 3 | **Pruebas unitarias** | Lógica de negocio pura: validaciones, permisos, formatos, enlaces | `npm test` | ~1 s |
| 4 | **Pruebas de contrato** | Que el código y la base de datos no se desincronicen | `npm test` | ~1 s |
| 5 | **QA de base de datos** | RLS, permisos por rol, integridad referencial, storage — contra la **BD real** | `npm run qa:db` | ~45 s |
| 6 | **Build** | Que lo que compila localmente es lo que se despliega | `npm run build` | ~1 min |

`npm run preflight` las corre todas en ese orden y se detiene temprano si fallan
las tres primeras, porque seguir sería perder tiempo.

### Por qué en ese orden

De más rápido y más barato a más lento. Si te falla un tipo, no tiene sentido
esperar 45 segundos al QA de base de datos para enterarte.

---

## 2. Los comandos

```bash
npm run preflight              # todo — la puerta antes de producción
npm run preflight -- --rapido  # sin build, para revisar mientras trabajas
npm run preflight -- --sin-bd  # sin QA de BD, cuando no hay conexión

npm test                       # solo pruebas unitarias y de contrato
npm run test:watch             # en vivo mientras escribes código
npm run test:coverage          # cobertura → docs/qa/coverage/index.html

npm run qa:db                  # solo QA de base de datos
npm run qa:db -- --quiet       # solo lo que no está en verde
npm run qa:db -- --json        # salida JSON, para CI
```

Todos salen con **código 1 si algo falla**, así que sirven tal cual en un hook de
git o en un job de CI.

---

## 3. Cómo leer las banderas

Cada comprobación deja una de tres:

| Bandera | Significa | Qué haces |
|---------|-----------|-----------|
| 🟢 **OK** | Verificado contra la realidad, no supuesto | Nada |
| 🟡 **AVISO** | Funciona, pero es deuda o un riesgo latente | Decides tú: se puede desplegar, se anota |
| 🔴 **FALLA** | Algo está roto o abierto | **No se despliega.** Se arregla |

El QA de base de datos resume todo en un **semáforo**: rojo si hay alguna falla,
amarillo si solo hay avisos, verde si está todo limpio.

> Un 🟡 no es "ignóralo". Es "esto no te bloquea hoy, pero alguien tiene que
> decidir qué hacer con ello". Los avisos que ya se decidieron aceptar están
> listados abajo, en la sección 6.

---

## 4. Qué cubre cada cosa, en concreto

### Pruebas unitarias — `tests/unit/`

| Archivo | Qué protege |
|---|---|
| `roles.test.ts` | La matriz de acceso por módulo. Que ningún módulo quede sin dueño, que solo los admin entren a Configuración, que sin rol no se entre a nada |
| `validations.test.ts` | Los esquemas Zod de todos los formularios. Que el consentimiento de datos (Ley 1581) sea obligatorio, y que **los errores caigan campo por campo** en vez de un toast genérico |
| `contacto-acciones.test.ts` | Los botones de WhatsApp / llamar / correo de la ficha de contacto. Que un fijo de Bogotá no acabe marcando a Malasia |
| `media-kind.test.ts` | Clasificación de archivos subidos. El material de campo llega sin mime, la caída a la extensión tiene que funcionar |
| `utils.test.ts` | Formato de fechas, iniciales, clases de Tailwind y la fragmentación de la base de conocimiento |

**Qué NO cubren, y por qué.** Los cinco archivos de arriba están al 100 % de
líneas. El resto de `src/lib/` está en 0 %: son envoltorios de red y de SDKs
externos (Supabase, Google Drive, ElevenLabs, Higgsfield, los proveedores de IA,
las subidas a storage). Probarlos con *mocks* mediría los mocks, no el
comportamiento real; esa parte se valida en la capa 5, contra la base y el
storage de verdad. La cobertura global (~33 %) hay que leerla con eso en mente:
**lo que tiene lógica está cubierto; lo que solo llama a un tercero, no.**

### Pruebas de contrato — `tests/contract/`

Esta es la capa que más se olvida y la que más caro sale.

- **`qa-contract.test.ts`** — `scripts/qa-contract.mjs` describe lo que el QA
  espera encontrar en Postgres. Si alguien agrega un rol o un módulo en
  `src/types/roles.ts` y no lo refleja allí, el QA seguiría validando contra una
  expectativa vieja y **daría verde en falso**. Esta prueba lo impide.

- **`migraciones.test.ts`** — revisa el historial de `supabase/migrations/`:
  - Formato `NNNN_nombre.sql` y cabecera explicando qué hace.
  - Que no se introduzcan números duplicados nuevos (dos migraciones con el
    mismo número se aplican en orden alfabético, no en el que pensaste).
  - Que **ninguna tabla nueva de `public` se quede sin RLS**. Este es
    exactamente el agujero que tuvo `task_due_pings`: un `create table` cuyo
    `enable row level security` nunca llegó, y la tabla quedó abierta a la Data API.
  - Que ninguna función `SECURITY DEFINER` se quede sin `search_path` fijo.

### QA de base de datos — `scripts/db-qa.mjs`

52 comprobaciones contra la base **real**, en 8 grupos. Lo que lo hace útil no es
que lea metadatos, sino que **prueba de verdad**:

- **Impersona a cada usuario** bajo RLS (`set local role authenticated` con su
  JWT) y comprueba que ve módulos y que no alcanza `app_secrets`.
- Se hace pasar por **anónimo** y comprueba que no lee nada interno.
- Recorre **las 112 claves foráneas** buscando filas huérfanas de verdad.
- Contrasta el enum `app_role` y los módulos de la BD contra las constantes del
  código.
- Verifica que los buckets privados sigan privados y que no haya políticas de
  storage apuntando a buckets fantasma.

---

## 5. La rutina antes de desplegar

1. `npm run preflight`
2. Si sale 🟢 → despliega.
3. Si sale 🔴 → lee qué etapa falló. El detalle queda en
   `docs/qa/preflight-latest.md` y `docs/qa/db-qa-latest.md`.
4. **Si tocaste la base de datos**, aplica primero la migración y vuelve a correr
   el preflight:
   ```bash
   node --env-file=.env.local scripts/db-exec.mjs supabase/migrations/00XX_lo_que_sea.sql
   npm run qa:db
   ```

> El QA de base de datos apunta a la **base de producción**. Es a propósito: es la
> única forma de saber que producción está bien. Pero solo lee — no escribe nada,
> y las simulaciones de usuario van dentro de una transacción con `rollback`.

---

## 6. Avisos aceptados hoy

Estos 🟡 están vistos y decididos. Si aparece uno nuevo que no esté aquí, hay que
mirarlo.

| Aviso | Por qué se acepta |
|---|---|
| Extensiones `pg_trgm` y `vector` en `public` | Se instalaron ahí de origen. Moverlas a `extensions` obliga a reconstruir índices; no compensa hoy |
| `citizen_tags` con RLS y sin políticas | Tabla muerta: ningún código la usa. Queda cerrada, que es el estado seguro |
| 68 claves foráneas sin índice | La base pesa 19 MB. Irrelevante con este volumen; hay que revisarlo antes de crecer en serio |

---

## 7. Cómo extender esto

**Agregaste lógica pura** (una función de formato, una validación, un cálculo) →
prueba unitaria en `tests/unit/`. Regla práctica: si tiene un `if`, merece una prueba.

**Agregaste un rol o un módulo** → tócalo en `src/types/roles.ts` **y** en
`scripts/qa-contract.mjs`. Si olvidas uno, `qa-contract.test.ts` te avisa.

**Agregaste una tabla** → en la misma migración, `enable row level security` y sus
políticas. `migraciones.test.ts` te avisa si se te pasa.

**Agregaste un bucket** → decláralo en `BUCKETS_ESPERADOS` de
`scripts/qa-contract.mjs` con su visibilidad.

**Quieres una comprobación nueva de base de datos** → una función más en la
sección que corresponda de `scripts/db-qa.mjs`, usando `ok()`, `aviso()` o
`falla()`. El reporte y el semáforo se arman solos.

---

## 8. Dónde queda todo

```
scripts/
  preflight.mjs        · el orquestador de las 6 etapas
  db-qa.mjs            · las 52 comprobaciones contra Postgres
  qa-contract.mjs      · qué esperamos encontrar en la BD (compartido con las pruebas)
  db-exec.mjs          · aplica migraciones .sql
tests/
  unit/                · lógica pura
  contract/            · sincronía código ↔ base de datos
docs/qa/
  README.md            · esto
  db-qa-latest.md      · último QA de base de datos (se regenera, no se versiona)
  preflight-latest.md  · último preflight (se regenera, no se versiona)
  coverage/            · cobertura HTML (se regenera, no se versiona)
```
