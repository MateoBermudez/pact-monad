# app — frontend + backend de Next.js

Next.js 16 (App Router), TypeScript estricto, ethers, Supabase (Postgres), zod.

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
| `POST /api/files` · `GET /api/files/[id]` | sí · opc. | Subir archivo (brief, portafolio, evidencia) / URL firmada |
| `GET /api/providers?skills=&q=` | opc. | Buscar proveedores, ordenados por relevancia y calificación |
| `GET/POST /api/listings` | opc. · sí | Solicitudes: `scope=recommended\|open\|mine` / crear (texto, archivo o ambos) |
| `GET/PATCH /api/listings/[id]` | opc. · sí | Detalle / editar borrador |
| `POST /api/listings/[id]/structure` | sí | La IA propone título, monto, plazo, categoría y reglas (cuesta créditos) |
| `GET/PUT /api/listings/[id]/rules` | sí | Ver / editar las reglas (cada guardado es una versión) |
| `POST /api/listings/[id]/publish` · `/close` | sí | Publicar (fija el hash de las reglas) / cerrar |
| `GET/POST /api/listings/[id]/applications` | sí | Postulantes (solo el dueño, ordenados por encaje) / postularse |
| `GET /api/applications` · `PATCH /api/applications/[id]` | sí | Mis postulaciones / `shortlist`, `reject`, `select`, `withdraw` |
| `GET /api/agreements` · `/api/agreements/[id]` | sí | Mis acuerdos / detalle con reglas, decisiones de la IA y calificaciones |
| `POST /api/agreements/[id]/review` | sí | La IA revisa la entrega; con `{ "release": true }` paga si el límite on-chain lo permite |
| `POST /api/agreements/[id]/rating` | sí | Calificar a la contraparte de un acuerdo aprobado |
| `GET /api/dashboard` | sí | Panel financiero: bloqueado, pagado, recibido, saldo, historial |
| `GET /api/stream` | sí | Tiempo real (SSE): avisa con `change` cuando algo tuyo cambió; se vuelve a pedir `/api/dashboard` |
| `GET /api/credits` · `POST /api/credits/purchase` | sí | Créditos de IA / acreditar un pago en MON hecho a la tesorería |
| `GET /api/settings/ai` | sí | Límite de pago autónomo de la IA (el valor real vive en el contrato) |
| `GET/POST /api/agent-keys` · `DELETE /api/agent-keys/[id]` | sí (wallet) | Claves de API de agentes |
| `POST /api/chain/sync` | sí | Fuerza una sincronización con la cadena |

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
```

Variables en `.env.example`; copiar a `.env.local`. Para probar contra una cadena local: `anvil`, desplegar con
`forge script script/Deploy.s.sol`, y arrancar con `INDEXER_BLOCK_TAG=latest` y las variables de `NEXT_PUBLIC_*` de esa cadena.
