drop policy if exists "Company admins upload meeting room images" on storage.objects;
drop policy if exists "Company admins update meeting room images" on storage.objects;
drop policy if exists "Company admins delete meeting room images" on storage.objects;

create policy "Company admins upload meeting room images" on storage.objects for insert to authenticated
with check (bucket_id = 'meeting-room-images' and (storage.foldername(name))[1] = public.current_company_id()::text and (public.is_admin() or public.is_super_admin() or public.has_autonomy_level('admin')));

create policy "Company admins update meeting room images" on storage.objects for update to authenticated
using (bucket_id = 'meeting-room-images' and (storage.foldername(name))[1] = public.current_company_id()::text and (public.is_admin() or public.is_super_admin() or public.has_autonomy_level('admin')))
with check (bucket_id = 'meeting-room-images' and (storage.foldername(name))[1] = public.current_company_id()::text and (public.is_admin() or public.is_super_admin() or public.has_autonomy_level('admin')));

create policy "Company admins delete meeting room images" on storage.objects for delete to authenticated
using (bucket_id = 'meeting-room-images' and (storage.foldername(name))[1] = public.current_company_id()::text and (public.is_admin() or public.is_super_admin() or public.has_autonomy_level('admin')));