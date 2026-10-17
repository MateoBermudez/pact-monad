# PACT — Monad Blitz Medellín V2

Red de trabajo freelance entre personas y agentes de IA sobre Monad. El cliente bloquea MON en un contrato, el proveedor
entrega y el pago se libera cuando el cliente aprueba. La IA estructura la solicitud, propone las reglas de aceptación
(que el humano ajusta), revisa la entrega regla por regla y puede pagar sola **solo dentro del límite que el cliente
fijó en el contrato** (0 por defecto), dejando constancia verificable de por qué.

Evento: sábado 17 de octubre de 2026 · Indie Universe, Medellín.

## Estructura

```
pact-monad/
├── contracts/   Solidity + Foundry. PactEscrow.sol, 53 pruebas y script de despliegue
├── app/         Next.js 16 (TypeScript estricto). Backend: lado servidor (app/api/*, lib/server/) + base en Supabase
└── frontend/    Maqueta visual (TanStack Start). Se migrará a app/ para tener front y back en un solo proyecto
```

**El backend vive aquí, en el lado servidor de Next.js.** La conexión con la IA está en un repo aparte, **`pact-ai`**
(Python, FastAPI + Gemini vía Google AI Studio), que solo habla con el modelo: estructura solicitudes y revisa entregas,
sin lógica de negocio ni acceso a la blockchain. La app lo localiza con la variable `AI_API_URL`.

Flujo: usuario (MetaMask) → `app` → rutas `/api/*` → `pact-ai` (Gemini) y Supabase. El dinero solo se mueve contra el
contrato: por la firma del cliente o del proveedor, o por el agente de IA dentro del límite on-chain del cliente.
Un indexador copia los eventos del contrato a Supabase; de ahí salen el panel financiero y el tiempo real.

## Decisiones cerradas

| Tema | Decisión |
|---|---|
| Aprobación | El **cliente firma** el pago, o la IA lo hace sola **solo si el cliente fijó un límite** en el contrato y el monto lo respeta (0 por defecto, con tope fijo). Si la IA dice "revisar", nunca paga sola |
| Reglas | La IA propone las reglas de aceptación, el humano las edita y al publicar su hash queda fijado en el contrato |
| Trazabilidad | Cada decisión de la IA queda en un registro inmutable (reglas, hallazgos, motivo) y su hash se ancla en la transacción de pago |
| Sesión | Firma de un mensaje con la wallet (sin contraseñas, sin gas). Se puede explorar sin sesión. Los agentes usan claves de API |
| Base de datos | Supabase (Postgres) por el pooler; esquema en `app/db/migrations` |
| Evidencia | URL guardada on-chain más una nota corta del proveedor |
| Moneda | MON nativo de Monad Testnet (chain ID `10143`) |
| Wallet | MetaMask, con ethers.js |
| IA | **Python + Gemini (Google AI Studio, capa gratuita)**. Cambia respecto al plan técnico original, que usaba la API de Claude desde Next.js |

## Arranque

```sh
# app (completar .env.local; ver comentarios en .env.example)
cd app && cp .env.example .env.local && pnpm install
pnpm db:migrate        # aplica app/db/migrations a Supabase
pnpm dev               # http://localhost:3000

# ia: ver el README del repo pact-ai (uvicorn en el puerto 8000)

# contracts (requiere Foundry: brew install foundry, o https://getfoundry.sh)
cd contracts && forge build && forge test
```

## Seguridad

- Las claves (`GEMINI_API_KEY` en `pact-ai`; `PRIVATE_KEY` en `contracts`; `AGENT_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y la contraseña de la base en `app`) viven solo en archivos `.env` ignorados por git. Se versionan únicamente los `.env.example`.
- `PRIVATE_KEY` y `AGENT_PRIVATE_KEY` son de wallets de testnet nuevas y desechables, nunca personales ni la misma entre sí.
- La clave del agente solo puede ejecutar `releaseByAgent`: paga al proveedor acordado, en acuerdos entregados y dentro del límite que fijó el cliente.
- El navegador nunca llama directo al servicio de IA: pasa por las rutas del servidor de Next.js, que exigen sesión y cobran créditos.
- Si `pact-ai` tiene URL pública, definir `PACT_AI_SHARED_SECRET` (en Next.js, `AI_API_SECRET`): sin él cualquiera gasta la cuota de Gemini.

## Plan de entregables

A. Contrato y pruebas en local → B. Despliegue en Monad Testnet → C. Flujo manual sin IA → D. Capa de IA → E. Ensayo de la demo.

Estado: **A y D hechos y probados** (contrato con 53 pruebas; backend con indexador, solicitudes, reglas, postulaciones,
revisión de la IA, pago autónomo, calificaciones, créditos, panel y tiempo real). **Pendiente:** B (desplegar el contrato
en Monad Testnet: la wallet que despliega necesita MON de faucet), conectar el frontend a la API (C) y la `GEMINI_API_KEY`
para la IA real. La maqueta visual vive en `frontend/`; el repo `pact-escrow` conserva su historia original.

## Maqueta visual actual

La carpeta  `frontend/` contiene el estado actual de la interfaz de PACT, importado como archivos sin el historial de pact-escrow. Incluye ilustraciones animadas, tipografía Intropol, logos y favicon de PACT, y los ajustes de las cards y del encabezado. Mantiene su estado de demostración en React; todavía no está conectada al backend de app/.

Para ejecutarla: entrar en frontend/, ejecutar npm ci y luego npm run dev. Para compilar: npm run build. Los contratos y el backend existentes se conservan en contracts/ y app/.
