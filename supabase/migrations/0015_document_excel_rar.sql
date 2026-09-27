-- Excel (.xls, .xlsx) e archivi RAR nel bucket documenti. Limite 50MB per i RAR con più file.
update storage.buckets
set
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'text/plain',
    'text/html',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.rar',
    'application/x-rar-compressed'
  ]
where id = 'documents';
