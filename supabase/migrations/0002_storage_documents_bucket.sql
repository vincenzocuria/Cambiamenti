-- Bucket privato per i documenti (max 20MB, solo PDF/Word/immagini)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 20971520,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png']
)
on conflict (id) do nothing;

create policy "documents_bucket_select" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and app.is_staff());
create policy "documents_bucket_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and app.is_staff());
create policy "documents_bucket_update" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and app.is_staff())
  with check (bucket_id = 'documents' and app.is_staff());
create policy "documents_bucket_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and app.is_staff());
