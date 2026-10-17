# Instrucciones para agentes

## Commits

- **Nunca pongas a una IA como coautora de un commit.** Nada de `Co-Authored-By: Claude …` ni trailers equivalentes
  (Copilot, Codex, Gemini, Cursor, etc.), y nada de líneas tipo "Generated with …" en commits ni en PRs.
  El autor es la persona del equipo que hace el commit.

## Arquitectura

- **El backend vive en `app/`, del lado servidor de Next.js**: rutas `app/api/*` y código en `lib/server/`.
  Ahí va la lógica de negocio, la validación de entradas y cualquier lectura del contrato que haga el servidor.
- **`pact-ai` (repo aparte) es únicamente la conexión con la IA.** Recibe texto, llama a Gemini y devuelve la respuesta
  estructurada. No tiene lógica de negocio, ni estado, ni acceso a la blockchain. Next.js lo llama desde el servidor con
  `AI_API_URL`; el navegador nunca habla con él directamente.
- **El dinero solo se mueve con transacciones contra el contrato en `contracts/`**, y solo hay dos formas de liberarlo:
  la firma del cliente desde su wallet (`approveAndRelease`) o el agente de IA (`releaseByAgent`), que el contrato
  limita por cliente: el límite vive on-chain, vale 0 por defecto y tiene un tope fijo. El agente solo puede pagar al
  proveedor acordado, nunca a otra dirección. El backend firma como agente con `AGENT_PRIVATE_KEY` (solo en
  `app/.env.local`), y solo después de guardar la decisión de la IA en la tabla `decisions` (inmutable), cuyo hash va
  en la transacción. Si la IA dice "revisar", nunca se libera sola.
- **Base de datos: Supabase (Postgres) por el pooler**, desde `lib/server/db.ts`. Los cambios de esquema son
  migraciones numeradas en `app/db/migrations` (`pnpm db:migrate`); nunca se edita una migración ya aplicada.
- **Todo en TypeScript estricto, sin `any`.** Las entradas de las rutas se validan con zod; los tipos que comparten
  servidor y navegador viven en `lib/shared/`. Las rutas son delgadas: la lógica va en `lib/server/services/`.
- Código que solo corre en el servidor importa `server-only`; el del navegador, `client-only`; lo compartido va en
  `lib/shared/`.

## Base de datos compartida y migraciones

Todo el equipo (y sus agentes) comparte **la misma base de Supabase**. Por eso:

- **Antes de crear una migración, `git fetch` y mira `select name from schema_migrations`**: usa el siguiente número libre.
  Ya hubo migraciones con el mismo número aplicadas desde clones distintos.
- **Sube el archivo de la migración en cuanto la apliques.** Una migración aplicada en la base y ausente del repositorio
  deja a los demás con un esquema que no pueden reproducir.
- Nunca edites una migración ya aplicada: crea otra.
- Las pruebas no deben asumir datos fijos (por ejemplo, el número exacto de habilidades): otras personas los cambian.

## Trabajo en segundo plano

- Lo que deba ocurrir después de un evento (revisar una entrega, avisar a un webhook) se anota en la cola (`jobs`,
  `webhook_deliveries`) **dentro de la misma transacción** que lo provoca; nunca se confía en `after()` ni en memoria.
- El worker (`lib/server/services/worker.ts`) es el único que ejecuta la cola. Es seguro correrlo varias veces a la vez.
- Los pagos del agente pasan por `releaseByAgent` (candado de la base). No envíes transacciones del agente por otro camino.
