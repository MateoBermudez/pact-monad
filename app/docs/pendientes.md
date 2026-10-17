# Pendientes — 17 de octubre de 2026

Lo que existe y se probó está en `roles-notificaciones.md`, `auth-ui.md` y `frontend-status.md`. Esto es lo que falta.

## Bloquea la demo o el despliegue

- [ ] **Desplegar `pact-ai` con URL pública y secreto compartido.** `PACT_AI_SHARED_SECRET` en `pact-ai` y el mismo valor
      en `AI_API_SECRET` de `pact-monad`. Sin secreto, cualquiera gasta la cuota de Gemini.
- [ ] **Variables de producción en Vercel:** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL*`, `FRONTEND_ORIGINS`
      con el dominio real, contrato, RPC, bloque de despliegue, clave del agente con gas y tesorería.
- [ ] **Supabase Auth en producción:** agregar el dominio a Redirect URLs. La URL de retorno de Google y GitHub es la de
      Supabase, así que no cambia.
- [ ] **Google en modo "Pruebas":** solo entran los correos registrados como usuarios de prueba (máximo 100). Para abrirlo
      hay que publicar la app.
- [ ] **Prueba de extremo a extremo con dos personas y dinero real de testnet:** acceso → perfil → wallet → crear →
      aceptar → entregar → revisión con IA → liberar o reembolsar. Hoy las pruebas con base real cubren cada tramo por
      separado, no el recorrido completo ni la firma con MetaMask.
- [ ] **Claves expuestas:** la clave de Gemini que estuvo en `.env.example` quedó en el historial de la rama
      `feat/servicio-ia` de `pact-ai`. Ya está revocada; falta borrar esa rama remota (se reemplazó por `main`).

## Interfaz sin construir (el backend ya existe)

- [ ] **Explorar solicitudes:** lista recomendada (`GET /api/listings?scope=recommended`) con puntaje y motivos.
- [ ] **Detalle de solicitud** (`/solicitud/[id]`): la campanita no tiene a dónde llevar al tocar un aviso.
- [ ] **Postularse** y, para el cliente, **ver postulantes, compararlos y elegir** (`/api/applications`).
- [ ] **Buscar prestadores** (`/api/providers`) y perfil público (`/api/users/{id o @username}`).
- [ ] **Subir briefs, portafolio y evidencias:** el cliente de subida directa existe, no hay selector de archivos.
- [ ] **Refinar el borrador con IA** ("hazlo en 3 días"): `pact-ai` lo soporta (`previous` + `feedback`), la app no lo usa.
- [ ] **Calificaciones** tras finalizar un acuerdo (`/api/agreements/{id}/rating`).
- [ ] **Créditos de IA:** saldo, consumo y compra con MON.
- [ ] **Panel de integraciones:** claves de agente y webhooks (crear, rotar secreto, ver entregas).
- [ ] **Vincular y desvincular** Google o GitHub desde la cuenta (`/api/auth/identities`, `?link=1`).
- [ ] **Foto de perfil por subida:** hoy solo se pega un enlace `https`.

## Notificaciones

- [ ] **Más eventos dentro de la app:** hoy solo `listing.matched`. Faltan "recibiste una postulación", "te eligieron",
      "entregaron", "aprobaron" y "la IA revisó". Los webhooks para agentes ya cubren esos eventos; la campanita no.
- [ ] **Preferencias:** silenciar, puntaje mínimo, categorías.
- [ ] **Fuera de la app:** correo o notificaciones push cuando la persona no tiene la pestaña abierta.
- [ ] **Avisar al editar** una solicitud ya publicada, y a quien se une después (perfil nuevo que encaja con solicitudes
      abiertas): hoy solo se avisa en el momento de publicar.
- [ ] **Escala del tiempo real:** cada conexión SSE consulta la base cada 2 s y llama a `syncAndProcess` (sincronización
      de la cadena). Con pocas personas está bien; con muchas hay que pasar a un solo proceso que reparta cambios, o a
      `LISTEN/NOTIFY`. Vercel además limita las conexiones largas (el cliente ya cae a consultas cada 5 s).

## Roles y cuentas

- [ ] **Permisos por rol en el resto de endpoints.** Hoy se exigen al crear solicitudes y al postularse. Revisar si
      elegir proveedor, cerrar o reabrir solicitudes y la configuración de la IA también deben exigirlo.
- [ ] **Agentes (`is_agent`) y roles:** definir qué rol tiene un agente y quién puede cambiarlo.
- [ ] **Unir cuentas con actividad:** si una cuenta de Google y otra de wallet tienen historial, no se unen solas. Hace
      falta un flujo de soporte o confirmación.
- [ ] **Eliminar cuenta** y exportar datos (los documentos legales lo prometen y no está implementado).

## IA

- [ ] **Medir calidad con casos reales:** se probó con pocas frases y 2 archivos. Falta un conjunto de ejemplos de la
      demo y ajustar los prompts.
- [ ] **Cupo gratuito de Gemini:** no se conocen los límites reales por modelo (la documentación no los lista; hay que
      mirar AI Studio). Con ensayos repetidos se puede agotar.
- [ ] **Datos de prueba:** en la capa gratuita Google puede usar lo que se envía; no subir documentos reales.
- [ ] **Matching más fino:** hoy es coincidencia de palabras y categoría. Se puede mejorar con embeddings
      (Gemini Embedding 2 tiene capa gratuita) si las recomendaciones salen pobres.

## Calidad y operación

- [ ] **Pruebas automáticas de extremo a extremo** (Playwright) con dos usuarios. Las comprobaciones con base real que se
      hicieron en esta etapa se escribieron como scripts sueltos y no están en el repo.
- [ ] **Numeración de migraciones:** hay números repetidos (008, 010, 011, 012) porque se trabajó en paralelo. No rompe
      nada (se distinguen por nombre) pero conviene un acuerdo: tomar el siguiente número libre justo antes de subir.
- [ ] **Prueba frágil:** `tests/crear.test.tsx` falló una vez por lentitud en frío y pasó en las siguientes.
- [ ] **Revisión en móvil** y de accesibilidad (teclado, lector de pantalla), y casos de error: firma cancelada, cambio de
      cuenta o de red, IA caída, red interrumpida.
- [ ] **Cifras de la landing para invitados:** hoy son genéricas y ciertas (3 pasos, MON, tu firma). La maqueta original
      traía números de marketing ("1.2K acuerdos", "48K MON"); no se usaron porque no son reales.
- [ ] **Documentos legales:** siguen siendo borradores; revisarlos con alguien competente.
- [ ] **`docs/frontend-status.md`** debe actualizarse con lo de este documento.
