# Roles, avisos y acceso

## Acceso

Regla única: **sin sesión solo existe el acceso; con sesión, el dashboard.**

| Situación | Resultado |
|---|---|
| Sin sesión en cualquier pantalla privada (`/dashboard`, `/crear`, `/perfil`, `/explorar`, `/cuenta`, `/pact/*`…) | Redirige a `/iniciar-sesion` |
| Sin sesión en la landing (`/`) | Se muestra con datos genéricos y los botones **Iniciar sesión** y **Registrarme** en el encabezado; sin barra inferior |
| Con sesión en la landing (`/`) | Se muestra la misma landing con **sus** datos: acuerdos en curso, que requieren su acción, MON bloqueados y cobrados |
| Sin sesión en `/iniciar-sesion`, `/registro`, `/terminos`, `/privacidad` | Se muestran, con encabezado mínimo (solo el logo) |
| Con sesión en `/iniciar-sesion` o `/registro` | Redirige a `/dashboard` |
| Sesión caducada o borrada (la cookie sigue en el navegador) | La interfaz borra la cookie y lleva a `/iniciar-sesion` |

- La regla vive en `lib/shared/routes.ts` (función pura, con pruebas) y la aplica `proxy.ts` antes de renderizar.
- `proxy.ts` solo mira si existe la cookie `pact_session`; la validez real la comprueba la API (`/api/auth/me`).
- Tras iniciar sesión con Google o GitHub, el callback lleva a `/perfil` si falta el username, el rol o las habilidades
  (un prestador necesita al menos una), y a `/dashboard` en los demás casos.
- Los errores del flujo OAuth vuelven a `/iniciar-sesion?auth_error=<código>`. Si la persona ya tenía sesión, vuelven a
  la pantalla de origen.
- Hay tres encabezados: `full` (dentro de la app: campanita, perfil, cerrar sesión, red, MetaMask), `guest` (landing sin
  sesión: logo, iniciar sesión, registrarme) y `minimal` (acceso, registro, legales y configuración inicial: solo el logo).
  La barra inferior solo aparece dentro de la app.
- Los números de la landing salen de `summarizePacts` (`lib/shared/ui-pact.ts`), el mismo cálculo del dashboard.
- Las ilustraciones de acceso son `public/illustrations/auth-login.svg` y `auth-registro.svg`.

## Roles

Cada cuenta tiene `roles`: `["client"]`, `["provider"]` o ambos. Una cuenta nueva empieza **sin rol** y debe elegirlo
(`needsRole` en `GET /api/auth/me`). Las cuentas anteriores a la migración 014 quedaron con ambos roles.

| Acción | Rol exigido | Error si falta |
|---|---|---|
| Crear una solicitud (`POST /api/listings`) | `client` | `403 role_required` |
| Postularse (`POST /api/listings/{id}/applications`) | `provider` | `403 role_required` |
| Aparecer en `GET /api/providers` | `provider` | — |
| Recibir avisos de solicitudes nuevas | `provider` | — |

- Se cambian con `PUT /api/profile` `{ "roles": ["client", "provider"] }` (mínimo uno, sin repetidos). Es el mismo
  formulario del registro y de `/perfil`.
- Quitar un rol con trabajo activo se rechaza con `409 role_in_use`: cliente con solicitudes `open`, `selecting` o
  `awarded`, o con acuerdos `Created`, `Accepted` o `Delivered`; prestador con postulaciones `submitted`, `shortlisted` o
  `selected`, o con acuerdos en curso.
- `GET /api/auth/me` devuelve `user.roles` y `onboarding: { needsUsername, needsRole, needsSkills, complete }`.
  `needsSkills` solo aplica a quien es prestador.

## Aviso de solicitudes que encajan

Al publicar una solicitud (`POST /api/listings/{id}/publish`), en la misma transacción:

1. Se buscan prestadores con rol `provider`, disponibilidad distinta de `unavailable`, que no sean el cliente y que
   tengan habilidades o palabras clave.
2. Se queda con quienes **comparten términos** con el título y las palabras clave de la solicitud, o cuya categoría de
   habilidades coincide con la de la solicitud (`isRelevantListing` en `lib/shared/matching.ts`). El puntaje base de una
   solicitud nueva ya es ~16 sin ninguna coincidencia, así que el puntaje por sí solo no sirve para decidir a quién avisar.
3. Ordena por puntaje (`scoreListingForProvider`) y avisa a los 50 mejores.
4. Por cada uno crea una **notificación** en la app y encola un **webhook `listing.matched`** (si tiene endpoints).
   Ambos son idempotentes por solicitud y destinatario.

### En la app

- `GET /api/notifications?limit=30` → `{ notifications, unread }`.
- `POST /api/notifications/read` `{ "ids": [1, 2] }` marca esas como leídas; sin `ids`, todas. Solo las propias.
- El canal SSE de `/api/stream` ya existente emite `change` cuando aparece o se lee una notificación
  (`loadChangeVersion` incluye la última notificación y el contador de no leídas).
- `NotificationBell` (en el encabezado) muestra el contador y la lista; `useNotifications` lanza un aviso emergente solo
  para las notificaciones nuevas, no para las que ya existían al cargar. Reutiliza la conexión SSE de `PactProvider`
  (`changes`) en vez de abrir otra.

### Para agentes

Evento `listing.matched` con `nextAction.action = "apply_to_listing"` y `youAct = true`:

```json
{
  "type": "listing.matched",
  "recipientRole": "provider",
  "data": { "listingId": "…", "title": "…", "category": "Diseño", "budgetMon": "12", "score": 76.2, "reasons": ["Coincide en: logo, branding"] },
  "nextAction": { "actor": "provider", "action": "apply_to_listing", "youAct": true, "hint": "Si te interesa, postúlate con POST /api/listings/{listingId}/applications {message, priceMon, days}" }
}
```

## Del borrador a la propuesta elegida

`/crear` es la única pantalla para crear (`/solicitudes/nueva` redirige a ella) y ya no pide la wallet del proveedor. Sus tres pasos son Describe, Revisa (con palabras clave y condiciones editables) y Publica. El orden es:

1. El cliente describe el trabajo o sube un brief (PDF, DOCX, imagen o texto) y la IA lo estructura en un documento por
   secciones (contexto, alcance y entregables, requisitos del perfil, condiciones, forma de entrega, por definir), con
   **8 a 15 palabras clave** y reglas de aceptación. Si la IA no responde, las palabras clave se sacan del texto
   (`deriveKeywords`). Al publicar, si siguen vacías, se derivan del título y la descripción.
2. El cliente revisa y edita todo, incluidas las palabras clave, y publica. Esas palabras y las habilidades de cada
   prestador deciden a quién se avisa primero (ver más abajo).
3. Los prestadores se postulan. **La wallet del proveedor no se pide nunca**: cuando el cliente (o su IA) elige a alguien,
   se toma de su perfil. Si esa persona no tiene wallet vinculada, no se la puede elegir y se avisa.
4. El cliente firma desde su wallet para bloquear los fondos.

`/crear?provider=0x…` (desde el perfil de una persona) conserva el acuerdo directo, porque ahí la wallet ya se conoce.

### Evaluación de propuestas con IA

Cada postulación crea una tarea `screen_application` en la cola (misma transacción que la postulación). El worker llama a
`POST /screen-applicant` de `pact-ai` con la oportunidad, el perfil, el portafolio, la reputación, la propuesta y los
criterios del cliente. El resultado se guarda en `applications` (`ai_verdict`, `ai_score`, `ai_summary`,
`ai_strengths`, `ai_concerns`) y solo lo ve el cliente. Cuesta 1 crédito (se devuelve si la IA falla; sin créditos no
se evalúa).

| Modo (`ai_settings.screening_mode`) | Qué hace |
|---|---|
| `assist` (por defecto) | Evalúa y **preselecciona** las que la IA recomienda aceptar. No descarta ni elige. |
| `auto` | **Descarta** las que no encajan y **elige** la primera que la IA acepta (el resto se descarta). El cliente solo firma para bloquear fondos. Si falta su wallet o la del prestador, deja la propuesta preseleccionada y avisa. |
| `off` | No evalúa nada. |

- Se configura en **Configuración → Cómo recibes las propuestas** (`GET/PUT /api/settings/screening`, con `criteria`
  opcional de hasta 1000 caracteres que la IA aplica al comparar).
- La IA nunca mueve dinero: elegir solo adjudica la solicitud; los fondos se bloquean con la firma del cliente.
- `pact-ai` no acepta con puntaje menor de 70 ni rechaza con puntaje mayor de 45: en ese caso devuelve `review`.
- Un perfil sin portafolio ni calificaciones normalmente queda en `review`: la IA acepta solo con evidencia.
- **El worker que ejecuta la tarea es el desplegado en producción**: el disparador de la base (migración 013) llama a
  `app_settings.worker_url`. En local las tareas las toma ese worker; hasta que la versión nueva esté desplegada fallan.

### Avisos dentro de la app (campanita)

| Tipo | Para quién | Cuándo |
|---|---|---|
| `listing.matched` | prestador | se publica una solicitud que encaja |
| `application.received` | cliente | alguien se postula (o la IA recomienda a alguien que no pudo elegir) |
| `application.auto_selected` | cliente | la IA eligió a un prestador en modo `auto` |
| `application.selected` | prestador | lo eligieron |
| `application.rejected` | prestador | lo descartaron |

## Archivos

Los briefs aceptan PDF, **DOCX**, texto, Markdown y PNG, JPEG o WebP (hasta 7 MB). El DOCX se convierte a texto en
`pact-ai`. El bucket de Supabase se abrió al DOCX en la migración 015.
