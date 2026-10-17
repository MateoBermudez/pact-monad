# PACT: interfaz migrada a Next.js

La aplicación principal vive ahora en `../app/`: frontend y API comparten Next.js, origen y sesión.

Desde esta carpeta, `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint` y `pnpm test` delegan a `../app/`.

Para instalar y configurar:

```sh
cd ../app
pnpm install --frozen-lockfile
# Completar .env.local a partir de .env.example
pnpm db:migrate
pnpm dev
```

La migración 008 vincula los acuerdos con proveedor directo a sus reglas confirmadas. No hay que configurar `VITE_API_URL` ni `BACKEND_URL` para la aplicación Next.js.

Los archivos `src/` y `public/` de esta carpeta se conservan como referencia histórica de la maqueta TanStack. No son el frontend activo. Para ejecutarla explícitamente: `pnpm dev:legacy`; sus pruebas antiguas: `pnpm test:legacy`.
