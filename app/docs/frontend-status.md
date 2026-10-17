# Estado del frontend — 17 de octubre de 2026

Revisado sobre main `9472711` y acceso social `bb7fa88` integrados.
“Conectado” significa que hay llamadas reales y contratos compatibles en código;
no sustituye una prueba con Supabase, OAuth, IA y Monad desplegados.

## Flujo implementado y conectado

- Acceso y registro Google/GitHub: rutas OAuth y callback del servidor.
- Perfil: consulta/reserva de nombre, catálogo de habilidades y guardado.
- Wallet: sesión previa, firma de reto, vinculación persistida y comprobación
  de que la cuenta de MetaMask coincide con la vinculada antes de operar.
- Crear acuerdo: descripción, estructuración con IA, revisión manual,
  confirmación, preparación en el backend y bloqueo mediante el contrato.
- Panel y detalle de acuerdos: lectura del backend, aceptar, cancelar,
  registrar entrega mediante URL, aprobar/liberar, revisión de IA e indexación.
- Límite de liberación automática: lectura del servidor y escritura on-chain.
- Actualizaciones: SSE con consulta periódica de respaldo para hosting que no
  mantenga la conexión, utilizando el cliente añadido en main.

## Funciones del backend sin interfaz completa

- Marketplace: buscar prestadores, perfiles públicos y publicar oportunidades.
- Postulaciones: presentar, comparar y seleccionar candidatos.
- Portafolio: edición y presentación de proyectos y archivos.
- Archivos: existe el cliente de subida directa a Supabase, pero las pantallas
  actuales no ofrecen selección/subida de briefs, portafolio o evidencias.
  Registrar una entrega actualmente permite pegar una URL.
- Calificaciones: API de rating sin formulario de valoración tras finalizar.
- Créditos de IA: API de saldo/compra sin pantalla de compra ni consumo.
- Integraciones avanzadas: claves de agente y webhooks sin panel de gestión.
- Cuenta: enlazar un segundo proveedor social y consultar identidades vinculadas
  tienen endpoints, pero faltan controles de administración en la interfaz.

## Pendientes para producción y validación

- Verificar migraciones aplicadas y configuración de Supabase, Storage,
  Google/GitHub y URLs de retorno. No se han aplicado migraciones en esta tarea.
- Configurar contrato, RPC, bloque de despliegue, servicio pact-ai, agente y
  worker/webhooks en el entorno de despliegue.
- Probar de extremo a extremo con dos usuarios: acceso → perfil → wallet →
  creación → aceptación → entrega → revisión → liberación/reembolso.
- Revisar móvil y escritorio en navegador y probar cancelaciones de firma,
  cambios de cuenta/red, errores de IA, permisos de archivos y red interrumpida.
- Revisar los borradores legales y conservar prueba de las autorizaciones
  exigibles. La nota del registro no implementa por sí sola esa persistencia.
- La elección cliente/proveedor/ambos ya es un rol real (`roles`) con permisos; ver `roles-notificaciones.md`.
  La lista completa de lo que falta está en `pendientes.md`.

No hay archivo `.env.local` en esta copia durante la revisión; no se ha
verificado el funcionamiento real de los servicios externos ni del dinero.
