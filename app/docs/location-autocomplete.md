# Sugerencias de ubicación

En `/cuenta`, el campo Ubicación consulta `GET /api/locations?q=...` después de
400 ms sin escribir y a partir de tres caracteres. La ruta exige sesión, valida
la búsqueda con zod y consulta Photon desde el servidor, con un tiempo máximo de
cinco segundos y caché de un día. No requiere claves ni cambios de base de datos.

El proveedor público es https://photon.komoot.io/, basado en OpenStreetMap.
Está pensado para uso moderado y no garantiza disponibilidad:
https://github.com/komoot/photon#demo-server. Para más tráfico se puede alojar
Photon y sustituir el endpoint en `lib/server/services/locations.ts`.

La selección sigue siendo texto editable y se guarda con el PUT de perfil
existente. Se muestran únicamente sugerencias que caben en el límite actual de
80 caracteres; no se guardan coordenadas ni se solicita geolocalización.
Si la búsqueda falla, el usuario puede completar el texto manualmente.

Para comprobarlo: escribir `Medellín`, elegir una sugerencia con las flechas y
Enter o con un clic, guardar el perfil y recargar. Cambiar rápidamente la
búsqueda debe ocultar los resultados anteriores. Escape cierra las sugerencias;
al continuar escribiendo se vuelven a buscar.
