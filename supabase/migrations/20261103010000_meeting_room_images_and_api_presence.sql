-- Per-room photo support. Images are public presentation assets; writes remain company-admin scoped.
alter table public.meeting_rooms
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meeting-room-images', 'meeting-room-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = true, file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Meeting room images are publicly readable" on storage.objects;
create policy "Meeting room images are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'meeting-room-images');

drop policy if exists "Company admins upload meeting room images" on storage.objects;
create policy "Company admins upload meeting room images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'meeting-room-images'
  and exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.user_id
    where p.user_id = auth.uid()
      and p.company_id::text = (storage.foldername(objects.name))[1]
      and p.is_active = true
      and ur.role in ('admin', 'super_admin')
  )
);

drop policy if exists "Company admins update meeting room images" on storage.objects;
create policy "Company admins update meeting room images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'meeting-room-images'
  and exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.user_id
    where p.user_id = auth.uid()
      and p.company_id::text = (storage.foldername(objects.name))[1]
      and p.is_active = true
      and ur.role in ('admin', 'super_admin')
  )
)
with check (
  bucket_id = 'meeting-room-images'
  and exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.user_id
    where p.user_id = auth.uid()
      and p.company_id::text = (storage.foldername(objects.name))[1]
      and p.is_active = true
      and ur.role in ('admin', 'super_admin')
  )
);

drop policy if exists "Company admins delete meeting room images" on storage.objects;
create policy "Company admins delete meeting room images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'meeting-room-images'
  and exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.user_id
    where p.user_id = auth.uid()
      and p.company_id::text = (storage.foldername(objects.name))[1]
      and p.is_active = true
      and ur.role in ('admin', 'super_admin')
  )
);
