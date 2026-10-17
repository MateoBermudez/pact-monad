# app — frontend + backend de Next.js

Next.js 16 (App Router), TypeScript estricto, ethers, Supabase (Postgres), zod.

## Interfaz migrada

Las páginas de PACT viven en `app/` y sus componentes interactivos en `components/pages/`. Estilos e Intropol se conservan en `app/globals.css` y `public/`. Navegación con `next/link` y `next/navigation`; no se necesita TanStack, Vite ni un proxy para acceder a la API.

- `/crear`: describe, revisa las condiciones y confirma con MetaMask. El paso 2 solo cambia de vista. Al confirmar, `POST /api/agreements/prepare` guarda los términos revisados y devuelve el hash de sus reglas; después la wallet llama a `createAgreement` con el ABI real. No hay firmas simuladas como respaldo.
- `/dashboard` y `/pact/[id]`: acuerdos reales desde la API, con avisos de actualización en `/api/stream`.
- `/configuracion`: consulta el límite y tope reales. Los cambios requieren una transacción `setAutoReleaseLimit` firmada por el cliente.
- `/conectar`: nonce del servidor, firma y verificación; restaura y cierra la sesión mediante las rutas existentes.

Aplicar `008_direct_agreements.sql` con `pnpm db:migrate` antes de crear acuerdos con proveedor directo. No modifica migraciones anteriores ni simula postulaciones de proveedores. Las reglas se congelan antes de firmar; rechazar una firma permite reintentar con las mismas condiciones, o editar y preparar otro borrador.

Configurar `.env.local` según `.env.example`: Supabase, IA y contrato. GitHub y Google todavía requieren su integración de backend. La interfaz usa actualmente la sesión de wallet disponible.

Validación: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test` (reglas existentes, formulario e integración de preparación) y `pnpm build`. Con Next ejecutándose en el puerto 3001, `node tests/smoke-next.mjs` comprueba páginas, assets y protección de la API sin iniciar sesión ni enviar transacciones.

## Qué corre dónde

En App Router **todo es Server Component por defecto**: se ejecuta solo en el servidor y al navegador llega HTML más
datos serializados, no el código. Un archivo se vuelve **Client Component** con `"use client"` en su primera línea; ese
archivo y todo lo que importa se empaquetan y se ejecutan en el navegador.

| | Servidor | Navegador |
|---|---|---|
| Qué es | páginas y layouts (por defecto), rutas `app/api/**/route.ts`, `lib/server/**` | archivos con `"use client"`, `lib/client/**` |
| Puede | leer secretos, base de datos, servicio de IA, cadena, firmar como agente | usar `window`, `useState`, `useEffect`, MetaMask |
| No puede | usar `window`, hooks de estado | leer `process.env` privado, importar `lib/server` |
| Variables de entorno | todas | solo las que empiezan con `NEXT_PUBLIC_` (se incrustan en el bundle) |

Dónde vive cada cosa en PACT:

- **Navegador:** conectar MetaMask, firmar el inicio de sesión y **firmar cada transacción** (crear, aceptar, entregar,
  aprobar, cancelar, fijar el límite de la IA). Las claves de las personas nunca salen de ahí.
- **Servidor:** base de datos, créditos, archivos, IA, indexador de la cadena y el agente que paga dentro del límite.
- **Compartido (`lib/shared`):** tipos, esquemas zod y lógica pura (coincidencias, reglas de dinero). Sin secretos ni `window`.

## Estructura

```
app/
├── app/api/                RUTAS (delgadas): validan con zod, llaman a un servicio y devuelven JSON
├── components/             FRONTEND: UI. Cada componente interactivo lleva "use client"
├── lib/
│   ├── server/             SOLO SERVIDOR (`import "server-only"`)
│   │   ├── services/         LÓGICA DE NEGOCIO: listings, applications, decisions, credits, dashboard, sync…
│   │   ├── chain/            proveedor RPC, contrato, decodificador de eventos, indexador
│   │   ├── auth.ts           sesión por wallet (SIWE), cookie deslizante y claves de API
│   │   ├── http.ts           authed / optional / open, errores tipados, validación
│   │   ├── db.ts             pool hacia Supabase (pooler), transacciones
│   │   ├── ai.ts             cliente de pact-ai (valida con zod lo que devuelve la IA)
│   │   └── storage.ts        Supabase Storage (bucket privado, URLs firmadas)
│   ├── client/             SOLO NAVEGADOR (`import "client-only"`): wallet.ts, auth.ts
│   └── shared/             tipos y esquemas compartidos
├── db/migrations/          esquema de Supabase, numerado. NUNCA se edita una migración ya aplicada
└── abi/PactEscrow.json     ABI exportado desde contracts/ (`bash script/export-abi.sh`)
```

Cómo se hace cumplir la frontera: `import "server-only"` / `"client-only"` (si un módulo cruza, **el build falla**), una
regla de ESLint que impide a `components/`, `lib/client` y `lib/shared` importar `lib/server` (`pnpm lint`), y que solo
`lib/server/env.ts` lee `process.env` privado.

## Sesión: sencilla y sin bloquear

- **Explorar no pide sesión.** Solicitudes abiertas, perfiles, portafolios y proveedores se ven sin firmar. Solo se pide
  firmar al actuar (`ensureSession()` en `lib/client/auth.ts` reutiliza la sesión y solo firma si falta o cambió la cuenta).
- **Iniciar sesión = firmar un mensaje con la wallet** (formato SIWE). No hay contraseña ni cuesta gas.
- **La sesión dura 30 días y se renueva con el uso** (tope absoluto de 90). Va en una cookie `HttpOnly`.
- **Agentes sin firma recurrente:** un usuario con `isAgent` crea claves de API (`POST /api/agent-keys`, requiere sesión de
  wallet) y desde ahí opera con `Authorization: Bearer pact_ak_…`, sin cookies. Solo se guarda su hash; se pueden
  revocar y tener vencimiento. Una clave no puede emitir más claves.
- La sesión nunca mueve dinero: cada transacción la firma la wallet por separado.

## API

Todas devuelven JSON. Errores: `{ "error": código, "message": texto }`. **Sesión:** `—` pública, `opc.` mejora con sesión,
`sí` la exige. Los tipos de entrada están en `lib/shared/schemas.ts` y los de salida en `lib/shared/*.ts`.

| Ruta | Sesión | Qué hace |
|---|---|---|
| `POST /api/auth/nonce`, `/verify`, `/logout` · `GET /api/auth/me` | — | Iniciar y cerrar sesión con wallet |
| `GET /api/skills` | — | Catálogo de habilidades |
| `GET/PUT /api/profile` | sí | Mi perfil: nombre, palabras clave, habilidades, `isAgent` |
| `GET /api/users/[id]` | opc. | Perfil público con reputación y portafolio |
| `GET/POST /api/portfolio` · `DELETE /api/portfolio/[id]` | sí | Mi portafolio (enlaces y archivos) |
| `POST /api/files/upload-url` → `PUT` a la URL → `POST /api/files/[id]/complete` | sí | Subir archivo (brief ≤7 MB, portafolio y evidencia ≤10 MB) directo a Storage; `uploadFile()` en `lib/client/files.ts` hace los 3 pasos |
| `GET /api/files/[id]` | opc. | URL firmada para descargar |
| `GET /api/providers?skills=&q=` | opc. | Buscar proveedores, ordenados por relevancia y calificación |
| `GET/POST /api/listings` | opc. · sí | Solicitudes: `scope=recommended\|open\|mine` / crear (texto, archivo o ambos) |
| `GET/PATCH /api/listings/[id]` | opc. · sí | Detalle / editar borrador |
| `POST /api/listings/[id]/structure` | sí | La IA propone título, monto, plazo, categoría y reglas (cuesta créditos) |
| `GET/PUT /api/listings/[id]/rules` | sí | Ver / editar las reglas (cada guardado es una versión) |
| `POST /api/listings/[id]/publish` · `/close` | sí | Publicar (fija el hash de las reglas) / cerrar |
| `GET/POST /api/listings/[id]/applications` | sí | Postulantes (solo el dueño, ordenados por encaje) / postularse |
| `GET /api/applications` · `PATCH /api/applications/[id]` | sí | Mis postulaciones / `shortlist`, `reject`, `select`, `withdraw` |
| `GET /api/agreements` · `/api/agreements/[id]` | sí | Mis acuerdos / detalle con reglas, decisiones de la IA y calificaciones |
| `POST /api/agreements/prepare` | sí | Congela condiciones y proveedor directo; devuelve los parámetros para firmar createAgreement |
| `POST /api/agreements/[id]/review` | sí | La IA revisa la entrega; con `{ "release": true }` paga si el límite on-chain lo permite |
| `POST /api/agreements/[id]/rating` | sí | Calificar a la contraparte de un acuerdo aprobado |
| `GET /api/dashboard` | sí | Panel financiero: bloqueado, pagado, recibido, saldo, historial |
| `GET /api/stream` | sí | Tiempo real (SSE): avisa con `change` cuando algo tuyo cambió; se vuelve a pedir `/api/dashboard` |
| `GET /api/credits` · `POST /api/credits/purchase` | sí | Créditos de IA / acreditar un pago en MON hecho a la tesorería |
| `GET /api/settings/ai` | sí | Límite de pago autónomo de la IA (el valor real vive en el contrato) |
| `GET/POST /api/agent-keys` · `DELETE /api/agent-keys/[id]` | sí (wallet) | Claves de API de agentes |
| `GET/POST /api/webhooks` · `PATCH/DELETE /api/webhooks/[id]` | sí | Webhooks salientes: registrar una URL (el secreto se muestra una sola vez), filtrar eventos, activar o borrar |
| `POST /api/webhooks/[id]/test` · `/rotate-secret` · `GET …/deliveries` | sí | Enviar un ping / rotar el secreto / ver los últimos envíos y por qué fallaron |
| `POST /api/chain/sync` | sí | Fuerza una sincronización con la cadena |
| `POST/GET /api/internal/worker` | secreto | Un paso del worker: sincroniza, ejecuta tareas y envía webhooks. Lo llama Supabase, no las personas |

### Flujo de una solicitud

1. `POST /api/listings` (texto, archivo o ambos) → borrador.
2. `POST …/structure` → la IA propone título, monto, plazo y **reglas de aceptación**.
3. `PUT …/rules` → el cliente las ajusta. `POST …/publish` fija el hash de las reglas.
4. Los proveedores se postulan; el cliente los ve ordenados por encaje y calificación y elige con `select`.
5. `select` devuelve `contractCall`: los parámetros exactos para firmar `createAgreement` desde la wallet. El indexador
   enlaza el acuerdo con la solicitud por el hash de las reglas.
6. El proveedor acepta y entrega on-chain. Al llegar la entrega, si el cliente activó la autonomía, la IA la revisa sola.
7. Pago: el cliente firma `approveAndRelease`, o la IA lo hace dentro del límite que el cliente fijó con `setAutoReleaseLimit`.

## Tiempo real

El indexador (`lib/server/chain/indexer.ts`) lee los eventos de `PactEscrow` en tramos de 100 bloques (límite del RPC de
Monad) y los copia a Supabase de forma idempotente. Varias instancias pueden correr a la vez: cada tramo se reserva con una
escritura condicional sobre `last_block`. `/api/stream` consulta una huella barata cada 2 s y avisa al navegador cuando cambia.

## Webhooks: avisar a quien le toca actuar

Las personas y, sobre todo, los **agentes** registran una URL (`POST /api/webhooks`) y reciben un aviso firmado cuando algo
les toca, en lugar de estar preguntando. Cada aviso dice **qué sigue y quién lo hace**:

```json
{
  "id": "2f1c…", "type": "agreement.delivered", "createdAt": "2026-10-17T18:30:00Z", "recipientRole": "client",
  "data": { "agreementId": "…", "chainAgreementId": "7", "contractAddress": "0x…", "amountMon": "10",
            "status": "Delivered", "evidenceUrl": "https://…", "providerNote": "Entrego PNG y SVG" },
  "nextAction": { "actor": "client", "action": "review_delivery", "youAct": true,
                  "hint": "Revisa con POST /api/agreements/{id}/review, o aprueba on-chain con approveAndRelease" }
}
```

Un agente solo reacciona cuando `nextAction.youAct` es `true`. Eventos: `application.received` · `application.selected` ·
`application.rejected` · `agreement.created` · `agreement.accepted` · `agreement.delivered` · `agreement.approved` ·
`agreement.cancelled` · `decision.created` · `ping`. Se pueden filtrar al registrar el webhook (vacío = todos).

**Verifica siempre la firma.** Cabeceras: `X-Pact-Signature: t=<segundos>,v1=<hmac>`, `X-Pact-Event`, `X-Pact-Delivery`.
La firma es HMAC-SHA256 de `"<t>.<cuerpo exacto>"` con el secreto del webhook. Rechaza mensajes con `t` de hace más de
5 minutos para evitar repeticiones. La verificación lista para copiar está en `lib/shared/webhook-signature.ts`:

```ts
import { verifyWebhook } from "./webhook-signature"; // Web Crypto: funciona en Node, Deno, Bun y navegadores
const valid = await verifyWebhook(secret, request.headers.get("x-pact-signature"), rawBody);
```

**Entrega y reintentos.** Responde con 2xx en menos de 10 s. Si no, se reintenta a los 30 s, 2 min, 10 min, 1 h y 6 h (6
intentos en total) y luego se da por fallido; tras 20 fallos seguidos el webhook se desactiva (se reactiva con
`PATCH {"active": true}`). Es **al menos una vez**: usa el `id` del aviso para ignorar duplicados. Los avisos de un mismo
destinatario salen en orden de creación, pero los reintentos pueden reordenar: confía en `createdAt` y en el estado.

**Seguridad de las URLs.** Solo `https` y puerto 443; se rechazan `localhost`, redes privadas, la red local, el servicio de
metadatos de la nube (`169.254.169.254`) y dominios que resuelvan a ellas. Se valida al registrar, otra vez antes de
cada envío y, además, al abrir la conexión (contra DNS que cambie de respuesta). No se siguen redirecciones.

## Trabajo en segundo plano (cola + worker)

Nada depende de que alguien tenga la app abierta. Cuando el indexador ve un evento, anota **en la misma transacción** los
avisos de webhook y, si es una entrega, la tarea "revisar con la IA" (tablas `webhook_deliveries` y `jobs`). Un worker
las reclama con `FOR UPDATE SKIP LOCKED` (varias instancias a la vez no duplican) y las ejecuta:

- Las tareas se reintentan con espera creciente (15 s, 30 s, 1 min…, máx. 5 intentos) si falla la IA o la red; los
  errores permanentes (acuerdo sin reglas) no se reintentan.
- Reclamar es un arrendamiento: si el worker muere a la mitad, la tarea vuelve sola cuando vence el plazo.
- Los eventos históricos (más de 10 min más viejos que el último bloque) se indexan pero no generan avisos ni
  revisiones, así reindexar desde cero no inunda a los agentes con el pasado.

El worker corre en `POST /api/internal/worker` (exige `x-pact-secret` = `INTERNAL_WEBHOOK_SECRET`, o el `CRON_SECRET` de
Vercel por `GET`). Tras cada sincronización con eventos nuevos la propia app lo dispara en segundo plano para que todo salga
al instante; el respaldo durable es quien llame a ese endpoint.

## Despliegue en Vercel

Está pensado para funcionar sin servidor propio: nada depende de un proceso encendido ni de que alguien visite la app.

1. **Proyecto:** importar el repo con *Root Directory* = `app`. Vercel detecta pnpm (campo `packageManager`).
2. **Variables de entorno** (Production), copiando de `.env.example`. Las `NEXT_PUBLIC_*` se incrustan al compilar, así que
   deben existir **antes** del build. Marcar como *Sensitive* las claves: `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `AGENT_PRIVATE_KEY`, `INTERNAL_WEBHOOK_SECRET`, `AI_API_SECRET`. Falta `CONTRACT_DEPLOY_BLOCK` y `INDEXER_BLOCK_TAG=finalized`.
3. **Región:** las funciones corren en `iad1` (US East) por defecto, la misma que Supabase (`us-east-1`): déjalo así.
4. **Conectar Supabase con la app desplegada** (una vez):
   ```sh
   pnpm db:webhooks -- --url https://TU-DOMINIO       # guarda el secreto en Vault, programa pg_cron y prueba la llamada
   ```
   Imprime un `INTERNAL_WEBHOOK_SECRET` nuevo: pégalo en Vercel, vuelve a desplegar y repite el comando; debe decir
   `Prueba : HTTP 200`. Con `--status` ves la configuración y las últimas llamadas; con `--off` se apaga.
   Usa el dominio de **producción**: si la protección de despliegues está activa, Vercel responde 401 a las llamadas de
   Supabase.
5. **El servicio de IA (`pact-ai`) va aparte** y también está en Vercel (Python, Fluid compute). Definir `PACT_AI_SHARED_SECRET`
   allí y `AI_API_SECRET` aquí con el mismo valor.
6. **Git:** ambos proyectos están conectados a su repo de GitHub; un push a `main` despliega a producción y los PRs generan
   preview. Producción: https://pact-monad.vercel.app (app) y https://pact-ai-eight.vercel.app (IA).

Qué hace que funcione en Vercel, y por qué:

| Límite de Vercel | Cómo se resuelve |
|---|---|
| Las funciones rechazan cuerpos de más de 4,5 MB | Los archivos se suben **directo a Storage** con URL firmada (`uploadFile()`); nunca pasan por una función |
| No hay proceso permanente: nadie ejecuta el indexador si nadie visita la app | `pg_cron` de Supabase llama a `/api/internal/worker` cada pocos segundos; un disparador de la base lo llama al instante cuando entra trabajo |
| El cron de Vercel en Hobby solo corre una vez al día | No dependemos de él: `vercel.json` deja uno diario solo como red de seguridad |
| Varias instancias a la vez | Cada tramo del indexador se reserva con una escritura condicional, las tareas con `SKIP LOCKED` y los pagos del agente con un candado de la base |
| Una función puede morir a mitad de camino | El trabajo pendiente vive en la base (cola durable con reintentos), no en memoria |
| Las funciones duran como máximo 300 s | El stream `/api/stream` se corta a los 4 min y el navegador reconecta; `subscribeToChanges()` pasa a consultar cada 5 s si el canal no se sostiene |
| Cada instancia abre sus propias conexiones | `DB_POOL_MAX` vale 2 por defecto en Vercel; el pooler de Supabase hace el resto |

## Base de datos

Supabase por el **pooler** (el host directo es solo IPv6). `DATABASE_URL` usa el modo transacción (puerto 6543) con un pool
de `DB_POOL_MAX` conexiones por instancia: el servidor admite 60 en total y Supabase ya usa unas 15. Las migraciones usan
`DATABASE_URL_SESSION`. RLS está activado sin políticas y se revocaron los permisos de `anon` y `authenticated`: solo este
servidor accede a los datos.

## Scripts

```sh
pnpm dev          # http://localhost:3000
pnpm lint
pnpm build
pnpm test         # lógica pura de coincidencias (node --test)
pnpm db:migrate   # aplica db/migrations a Supabase
pnpm db:webhooks  # conecta Supabase con la app desplegada (ver «Despliegue en Vercel»)
pnpm db:seed      # datos de ejemplo para la demo (perfiles, solicitudes, calificaciones); `-- --clean` los borra
```

Variables en `.env.example`; copiar a `.env.local`. Para probar contra una cadena local: `anvil`, desplegar con
`forge script script/Deploy.s.sol`, y arrancar con `INDEXER_BLOCK_TAG=latest` y las variables de `NEXT_PUBLIC_*` de esa cadena.
