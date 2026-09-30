-- File firmati digitalmente (.p7m, .p7s, …) nel bucket documenti
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
  'application/x-rar',
  'application/pkcs7-mime',
  'application/x-pkcs7-mime',
  'application/pkcs7-signature',
  'application/x-pkcs7-signature',
  'application/octet-stream'
]
where id = 'documents';
