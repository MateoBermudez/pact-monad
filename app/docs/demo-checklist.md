# Preparar y probar la demo de PACT

## Configuración

1. Hacer pull e instalar con `pnpm install` dentro de `app`.
2. Copiar `.env.example` a `.env.local`, o configurar las variables del hosting.
   Completar el pooler de Supabase, Auth y Storage. No compartir ni subir las
   credenciales. `SUPABASE_URL` es la misma para Auth y Storage.
3. Consultar `schema_migrations` en la base compartida y comprobar las migraciones
   del repositorio. Si faltan, el responsable ejecuta `pnpm db:migrate`.
   Esta ampliación no añade migraciones.
4. Habilitar Google y GitHub en Supabase Auth. Configurar callbacks de los
   proveedores y permitir `https://<dominio>/api/auth/callback` para PACT.
   Configurar `FRONTEND_ORIGINS` con el origen real de la demo y usar HTTPS.
5. Configurar `SUPABASE_SERVICE_ROLE_KEY` solo en servidor y el bucket privado
   `pact-files`. Verificar el PUT firmado desde el dominio de la demo. No se
   necesita una clave de Supabase en el navegador.
6. Configurar el despliegue publicado por Mateo:

   ```dotenv
   NEXT_PUBLIC_CHAIN_ID=10143
   NEXT_PUBLIC_CONTRACT_ADDRESS=0x09AE7717bdcDC03eA73D539ECc321Dc96B8a80D3
   CONTRACT_DEPLOY_BLOCK=71932735
   ```

   Ver `contracts/deployments/monad-testnet.json`. No usar el contrato de ensayo
   anterior. Conseguir MON de prueba para cliente, proveedor y agente.
7. Configurar `AI_API_URL` y el secreto compartido de pact-ai. Para liberación
   automática, configurar en servidor la clave del agente del contrato.
8. Para recargar créditos, configurar `TREASURY_ADDRESS` y `CREDIT_PRICE_MON`.
   Sin tesorería la interfaz no permite enviar el pago.
9. Configurar worker y avisos según el README: secreto interno, llamada
   programada desde Supabase y webhook de la cola. Verificar procesamiento de
   trabajos e indexación de bloques confirmados.
10. Ejecutar `pnpm build` y `pnpm start`, o desplegar en Vercel. Configurar las
    variables `NEXT_PUBLIC_*` antes de compilar.

## Recorrido con dos personas

Usar dos perfiles de navegador y wallets distintas. El proveedor necesita MON
de prueba para aceptar y registrar la entrega.

1. Sin sesión, abrir la landing y `/conectar`: no debe abrirse MetaMask. Acceder
   con Google para el cliente y GitHub para el proveedor. Probar cancelar OAuth.
2. Completar nombre y habilidades; probar nombre ocupado, editar presentación,
   enlaces y disponibilidad, y consultar el perfil público.
3. Vincular ambas wallets. Cancelar una firma y reintentar. Cambiar de cuenta
   en MetaMask: no debe cambiar el usuario social ni permitir operar con una
   dirección distinta de la vinculada.
4. Crear una oportunidad y adjuntar un brief. Estructurar con IA, revisar monto,
   plazo y reglas, guardar borrador, recargar y publicar. Si la IA falla, abrir
   el borrador y completar manualmente.
5. El proveedor busca la oportunidad, lee el brief y envía propuesta con precio
   y plazo. Consultar Postulaciones y retirar otra propuesta de prueba.
6. El cliente revisa perfil/portafolio y confirma proveedor. Todavía no se mueve
   dinero. Cancelar la firma del bloqueo, recargar y retomar. Confirmar una sola
   transacción, revisando el importe en MetaMask.
7. Ver el acuerdo en ambos paneles. Aceptar como proveedor y registrar entrega
   con archivo. El cliente debe poder abrirlo; una tercera cuenta no.
8. Pedir revisión con IA, comprobar el resultado y liberar desde la wallet del
   cliente. Comprobar el pago y valorar desde ambas cuentas una sola vez.
9. En otro acuerdo, cancelar antes de aceptar y comprobar reembolso. Probar el
   límite automático: cero no libera; un veredicto de revisión no libera; una
   entrega conforme dentro del límite puede liberarse por el agente. Comprobar
   decisión, hash y transacción.

## Otras comprobaciones

- **Portafolio:** publicar texto, enlace y archivo; abrir desde perfil público
  sin sesión y quitar un proyecto.
- **Créditos:** comprobar consumo al usar IA, comprar pocos créditos y verificar
  la misma transacción si falla la acreditación. El backend debe rechazar una
  segunda acreditación. No volver a pagar para recuperar un pago existente.
- **Cuenta:** vincular el segundo proveedor social, probar una identidad ya
  vinculada a otra cuenta y cerrar sesión.
- **Integraciones (opcional):** activar agente, crear/guardar/revocar una clave;
  conectar un receptor HTTPS, guardar su secreto y enviar una prueba. Comprobar
  entregas, pausa/reactivación y rotación del secreto. El worker debe estar activo.
- **Fallos y móvil:** teclado y últimos botones, cambio de red, conexión cortada,
  archivo grande/formato incorrecto, URL temporal vencida (generar otra) y fallo
  del servicio de IA.

## Validación local

Pruebas automatizadas de permisos, archivos, recuperación de condiciones,
wallet/sesión y pantallas. Compilación de producción y revisión en Chrome a
1440 y 390 px con datos interceptados de prueba. Esto no reemplaza el recorrido
real: no utiliza las credenciales del equipo ni mueve fondos.
