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
- **El dinero solo se mueve con transacciones firmadas por el cliente o el proveedor** desde su wallet, contra el
  contrato en `contracts/`. Ni el backend ni la IA tienen claves que muevan fondos.
- Código que solo corre en el servidor importa `server-only`; el del navegador, `client-only`; lo compartido va en
  `lib/shared/`.
