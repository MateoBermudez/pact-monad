update storage.buckets
   set allowed_mime_types = array_append(allowed_mime_types, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
 where id = 'pact-files'
   and not ('application/vnd.openxmlformats-officedocument.wordprocessingml.document' = any(allowed_mime_types));
