# app — frontend + backend de Next.js

Next.js 16 (App Router), TypeScript, Tailwind, ethers.

## Qué corre dónde

En App Router **todo es Server Component por defecto**: se ejecuta solo en el servidor y al navegador llega HTML más
datos serializados, no el código. Un archivo se vuelve **Client Component** con `"use client"` en su primera línea; ese
archivo y todo lo que importa se empaquetan y se ejecutan en el navegador.

| | Servidor | Navegador |
|---|---|---|
| Qué es | páginas y layouts (por defecto), rutas `app/api/**/route.ts`, `lib/server/**` | archivos con `"use client"`, `lib/client/**` |
| Puede | leer secretos, llamar al servicio de IA, leer la cadena | usar `window`, `useState`, `useEffect`, MetaMask |
| No puede | usar `window`, hooks de estado | leer `process.env` privado, importar `lib/server` |
| Variables de entorno | todas | solo las que empiezan con `NEXT_PUBLIC_` (se incrustan en el bundle) |

Dónde vive cada cosa en PACT:

- **Navegador:** conectar MetaMask y **firmar** cada transacción (crear, aceptar, entregar, aprobar, cancelar). La wallet solo
  existe en el navegador y las claves nunca salen de ahí.
- **Servidor:** hablar con el servicio de IA (`pact-ai`). La URL y cualquier clave quedan fuera del navegador.
- **Compartido:** tipos y constantes de red, sin secretos ni `window`.

## Estructura

```
app/
├── app/                    Rutas (App Router)
│   ├── api/                BACKEND: Route Handlers, solo servidor
│   │   ├── structure-agreement/route.ts
│   │   └── review-evidence/route.ts
│   ├── pact/[id]/page.tsx  Página (Server Component)
│   ├── layout.tsx
│   └── page.tsx
├── components/             FRONTEND: UI. Cada componente interactivo lleva "use client"
│   └── ui/                 Piezas de presentación sin lógica de negocio
├── lib/
│   ├── server/             SOLO SERVIDOR  (`import "server-only"`)
│   │   ├── env.ts            único lugar que lee variables privadas
│   │   └── ai.ts             cliente del servicio de IA
│   ├── client/             SOLO NAVEGADOR (`import "client-only"`)
│   │   └── wallet.ts         conexión a MetaMask y red Monad Testnet
│   └── shared/             Corre en ambos lados: sin secretos y sin `window`
│       ├── chain.ts          chain id, RPC, dirección del contrato
│       └── pact.ts           tipos y estados del acuerdo
└── abi/PactEscrow.json     ABI exportado desde contracts/ (`bash script/export-abi.sh`)
```

## Cómo se hace cumplir la frontera

1. `import "server-only"` / `import "client-only"` en la primera línea: si un módulo cruza al lado equivocado, **el build falla**.
2. Regla de ESLint (`no-restricted-imports`): `components/`, `lib/client` y `lib/shared` no pueden importar `lib/server`, y
   `lib/server` no puede importar `lib/client`. `npm run lint` lo verifica.
3. Solo `lib/server/env.ts` lee `process.env` privado. Ninguna clave usa el prefijo `NEXT_PUBLIC_`.

## Flujo de una acción

```
Navegador                         Servidor Next.js               Otros
─────────                         ────────────────               ─────
Describir trabajo ──POST /api/structure-agreement──► route.ts ──► pact-ai (Gemini)
Revisar y confirmar
Firmar con MetaMask ───────────────────────────────────────────► contrato en Monad
Ver evidencia ───────POST /api/review-evidence────► route.ts ──► pact-ai (Gemini)
```

El servidor nunca ve ni firma transacciones. La IA solo lee y sugiere.

## Scripts

```sh
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

Variables en `.env.example`; copiar a `.env.local`.
