# Bienvenida a PACT

`/bienvenida` es un recorrido privado de cuatro pasos: explorar oportunidades,
estructurar acuerdos con IA, entender wallet y pagos, y seguir entregas.

Al guardar un perfil que todavía no tenía nombre de usuario, `/perfil` abre el
recorrido. Al editar un perfil existente conserva su salida al dashboard.
También se puede repetir desde **Mi cuenta → Volver a ver la bienvenida a PACT**.
No necesita tablas, migraciones ni servicios adicionales.

Se puede omitir en cualquier paso. Los accesos finales usan los roles devueltos
por `/api/profile`; el recorrido no conecta wallets, modifica permisos ni envía
transacciones. Si falla la consulta del perfil, se puede terminar o salir igual.

Validación manual: completar un perfil nuevo, avanzar y retroceder, omitir,
reabrir desde Mi cuenta y comprobar los accesos con roles cliente, proveedor y
ambos. Revisar también a 390 px y con teclado.
