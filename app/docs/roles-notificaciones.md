# Roles, avisos y acceso

## Acceso

Regla única: **sin sesión solo existe el acceso; con sesión, el dashboard.**

| Situación | Resultado |
|---|---|
| Sin sesión en cualquier pantalla privada (`/`, `/dashboard`, `/crear`, `/perfil`, `/configuracion`, `/conectar`, `/pact/*`) | Redirige a `/iniciar-sesion` |
| Sin sesión en `/iniciar-sesion`, `/registro`, `/terminos`, `/privacidad` | Se muestran, con encabezado mínimo (solo el logo) |
| Con sesión en `/iniciar-sesion` o `/registro` | Redirige a `/dashboard` |
| Sesión caducada o borrada (la cookie sigue en el navegador) | La interfaz borra la cookie y lleva a `/iniciar-sesion` |

- La regla vive en `lib/shared/routes.ts` (función pura, con pruebas) y la aplica `proxy.ts` antes de renderizar.
- `proxy.ts` solo mira si existe la cookie `pact_session`; la validez real la comprueba la API (`/api/auth/me`).
- Tras iniciar sesión con Google o GitHub, el callback lleva a `/perfil` si falta el username, el rol o las habilidades
  (un prestador necesita al menos una), y a `/dashboard` en los demás casos.
- Los errores del flujo OAuth vuelven a `/iniciar-sesion?auth_error=<código>`. Si la persona ya tenía sesión, vuelven a
  la pantalla de origen.
- El encabezado completo (campanita, perfil, cerrar sesión, red, MetaMask) y la barra inferior solo aparecen dentro de la app.

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

## Archivos

Los briefs aceptan PDF, **DOCX**, texto, Markdown y PNG, JPEG o WebP (hasta 7 MB). El DOCX se convierte a texto en
`pact-ai`. El bucket de Supabase se abrió al DOCX en la migración 015.
