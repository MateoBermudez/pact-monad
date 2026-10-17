# Frontend de la demo

El frontend utiliza las APIs de Next.js. No hay datos simulados en las pantallas;
las pruebas de interfaz sí utilizan fixtures aislados.

| Vista | Ruta | Conexión |
|---|---|---|
| Acceso y registro | `/iniciar-sesion`, `/registro` | OAuth Google/GitHub |
| Perfil inicial | `/perfil` | Nombre de usuario, habilidades y perfil |
| Cuenta | `/cuenta` | Perfil ampliado, enlaces, disponibilidad, identidades y wallet |
| Explorar | `/explorar` | Oportunidades y prestadores con búsqueda y filtros |
| Solicitudes | `/solicitudes`, `/solicitudes/nueva`, `/solicitudes/[id]` | Brief, borrador, IA, condiciones, publicación, postulantes y selección |
| Postulaciones | `/postulaciones` | Estado y retirada de propuestas |
| Perfil público | `/personas/[id]` | Reputación, habilidades, enlaces y portafolio |
| Portafolio | `/portafolio` | Publicar/quitar proyectos y adjuntar archivos |
| Créditos | `/creditos` | Saldo, costes, pago y acreditación/reintento por hash |
| Integraciones | `/integraciones` | Claves de agente, revocación, webhooks, pruebas, secretos y entregas |
| Acuerdos | `/dashboard`, `/pact/[id]` | Estados, acciones del contrato, evidencias, IA y calificaciones |
| Crear directo | `/crear` | Descripción, revisión, proveedor y bloqueo de fondos |
| Configuración | `/configuracion` | Límite de liberación de IA en el contrato |

## Archivos

Se reutiliza el flujo existente: `POST /api/files/upload-url` → PUT directo a
Supabase → `POST /api/files/[id]/complete`. El servidor comprueba tamaño, tipo
real y hash. Límites compartidos: brief 7 MB, portafolio/evidencia 10 MB.

La evidencia registra `pact-file:<uuid>` en el contrato, no una URL que caduca.
El backend comprueba que pertenece al proveedor del acuerdo; permite leerla al
propietario y a las partes. Para la IA resuelve una URL firmada nueva sin
publicar el token de Storage en blockchain. Las URL externas siguen funcionando.

## Wallet y recuperación

Primero se inicia sesión. La wallet se verifica por firma y queda en
`users.wallet`; las transacciones comprueban la cuenta seleccionada.
Elegir una propuesta y firmar el bloqueo son pasos distintos.

`GET /api/listings/[id]/selection` recupera las condiciones canónicas y rechaza
otro bloqueo si ya existe un acuerdo indexado. Se conserva el hash enviado en
este navegador y se comprueba el recibo antes de reintentar. Si se pierde ese
estado, revisar Mis acuerdos y el explorer antes de volver a firmar.

## Qué falta fuera del código

Configurar y probar servicios reales. No se aplicaron migraciones ni se enviaron
transacciones reales durante esta ampliación. Esta copia no tiene `.env.local`.
Ver [demo-checklist.md](demo-checklist.md) para los pasos del equipo.

Ver también `roles-notificaciones.md` (roles, acceso y avisos) y `pendientes.md` (lo que falta).
