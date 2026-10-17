# Acceso social y perfil

Rama de interfaz: `feat/auth-perfil-ui`.

Rutas: `/iniciar-sesion`, `/registro`, `/perfil`, `/terminos` y `/privacidad`.
`/conectar` conserva la conexión de wallet para las operaciones on-chain.

La interfaz usa los contratos del backend en `feat/login-social`: inicio OAuth
`GET /api/auth/oauth/google|github`, callback del servidor, consulta de identidades
`GET /api/auth/identities` y disponibilidad/reserva de nombre `GET/PUT /api/username`.
Se integró `origin/feat/login-social` (bb7fa88), que incluye main (9472711).
Configurar Supabase, las migraciones y los proveedores sigue siendo necesario
para probar OAuth real. El acceso no crea sesiones simuladas.

MetaMask requiere una sesión previa, incluso en el cliente de wallet compartido.
La conexión explícita firma un reto y llama a `POST /api/auth/wallet`, que guarda
la dirección verificada en `users.wallet`. No se restauran conexiones de MetaMask
al entrar sin sesión. Las transacciones verifican que la cuenta seleccionada sea
la wallet vinculada; cambiar de cuenta en MetaMask no cambia la identidad social.

El perfil carga `/api/profile` y `/api/skills`. Las habilidades del catálogo se
guardan por slug, conservando su nivel; las añadidas libremente se guardan como
palabras clave. La elección de participación se guarda en `headline`, ya que el
backend no tiene un campo de rol. No cambia permisos. El nombre se reserva antes
de guardar el perfil; si falla la segunda operación, permanece reservado y se
puede reintentar el guardado sin cambiarlo.

Los documentos legales incluyen el responsable y contacto proporcionados por el
equipo. Son borradores para revisión. Antes de publicar el registro definitivo,
el backend debe conservar prueba de las autorizaciones exigibles, y el equipo
debe revisar los proveedores, transferencias y plazos reales de conservación.
La interfaz no afirma registrar esa prueba actualmente.
