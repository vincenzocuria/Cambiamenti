-- Ottimizzazioni advisor: auth.* dentro (select ...) per valutazione unica per query
alter policy "profiles_select" on public.profiles
  using (id = (select auth.uid()) or (select app.is_staff()));
alter policy "profiles_update_admin" on public.profiles
  using ((select app.is_admin())) with check ((select app.is_admin()));
alter policy "profiles_delete_admin" on public.profiles
  using ((select app.is_admin()) and id <> (select auth.uid()));

alter policy "courses_all" on public.courses
  using ((select app.is_staff())) with check ((select app.is_staff()));
alter policy "students_all" on public.students
  using ((select app.is_staff())) with check ((select app.is_staff()));
alter policy "teachers_all" on public.teachers
  using ((select app.is_staff())) with check ((select app.is_staff()));
alter policy "course_students_all" on public.course_students
  using ((select app.is_staff())) with check ((select app.is_staff()));
alter policy "course_teachers_all" on public.course_teachers
  using ((select app.is_staff())) with check ((select app.is_staff()));
alter policy "documents_all" on public.documents
  using ((select app.is_staff())) with check ((select app.is_staff()));

-- Indice mancante sulla foreign key documents.uploaded_by
create index documents_uploaded_by_idx on public.documents (uploaded_by);
