-- Bucket privado para briefs, portafolio y evidencia. Solo el servidor (service_role) lee y escribe en él;
-- el navegador recibe URLs firmadas de corta duración.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pact-files',
  'pact-files',
  false,
  10485760,
  array[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/zip'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
