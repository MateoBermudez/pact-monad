# PACT — Monad Blitz Medellín V2

Acuerdos verificables sobre Monad: el cliente bloquea MON en un contrato, el proveedor entrega y el pago se
libera cuando el cliente aprueba. La IA interpreta lenguaje natural y revisa evidencia, pero **nunca controla fondos**.

Evento: sábado 17 de octubre de 2026 · Indie Universe, Medellín.

## Estructura

```
pact-monad/
├── contracts/   Solidity + Foundry. PactEscrow.sol, tests y script de despliegue
└── app/         Next.js 16 (TypeScript, Tailwind). Frontend y backend: el backend es el lado servidor (app/api/*, lib/server/)
```

**El backend vive aquí, en el lado servidor de Next.js.** La conexión con la IA está en un repo aparte, **`pact-ai`**
(Python, FastAPI + Gemini vía Google AI Studio), que solo habla con el modelo: estructura solicitudes y revisa entregas,
sin lógica de negocio ni acceso a la blockchain. La app lo localiza con la variable `AI_API_URL`.

Flujo: usuario (MetaMask) → `app` → rutas `/api/*` → `pact-ai` (solo lectura). El dinero solo se mueve por transacciones
firmadas por el cliente o el proveedor contra el contrato.

## Decisiones cerradas

| Tema | Decisión |
|---|---|
| Aprobación | La IA sugiere, el **cliente firma** la transacción que libera el pago |
| Evidencia | URL guardada on-chain más una nota corta del proveedor |
| Moneda | MON nativo de Monad Testnet (chain ID `10143`) |
| Wallet | MetaMask, con ethers.js |
| IA | **Python + Gemini (Google AI Studio, capa gratuita)**. Cambia respecto al plan técnico original, que usaba la API de Claude desde Next.js |

## Arranque

```sh
# app
cd app && cp .env.example .env.local && pnpm install && pnpm dev          # http://localhost:3000

# ia: ver el README del repo pact-ai (uvicorn en el puerto 8000)

# contracts (requiere Foundry: https://getfoundry.sh)
cd contracts && forge install foundry-rs/forge-std && forge build
```

## Seguridad

- Las claves (`GEMINI_API_KEY` en `pact-ai`, `PRIVATE_KEY` en `contracts`) viven solo en archivos `.env` ignorados por git. Se versionan únicamente los `.env.example`.
- `PRIVATE_KEY` es de una wallet de testnet nueva y desechable, nunca una personal.
- El navegador nunca llama directo al servicio de IA: pasa por las rutas del servidor de Next.js.

## Plan de entregables

A. Contrato y pruebas en local → B. Despliegue en Monad Testnet → C. Flujo manual sin IA → D. Capa de IA → E. Ensayo de la demo.
Estado: estructura creada, sin lógica todavía. La maqueta visual está en el repo `pact-escrow` (rama `frontend-redesign`).
