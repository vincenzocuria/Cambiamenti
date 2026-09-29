-- Varianti MIME ZIP (Windows) oltre a RAR già presenti in 0015
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'text/plain',
  'text/html',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-rar'
]
where id = 'documents';
