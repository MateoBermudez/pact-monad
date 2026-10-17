-- La evidencia de una entrega puede ser cualquier tipo de archivo (hasta 50 MB, el tope por archivo del plan gratuito
-- de Storage). El tipo y el tamaño de cada propósito los valida la app antes de dar la URL de subida, así que el bucket
-- ya no necesita su propia lista de tipos permitidos.
update storage.buckets
   set allowed_mime_types = null,
       file_size_limit = 52428800
 where id = 'pact-files';
