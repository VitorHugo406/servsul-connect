-- Fotos e vídeos nos avisos (PC e app do celular).
--  * Bucket PRIVADO announcement-media, caminho <empresa>/<aviso>/<arquivo>; até 50 MB por arquivo (imagens e vídeos).
--  * announcement_media: um registro por arquivo. Quem vê o aviso vê a mídia (a política consulta announcements,
--    que já aplica empresa + setores do aviso); só o autor do aviso ou um admin envia/remove.
--  * Ao expirar (ou ao excluir o aviso) os arquivos saem do Storage: announcement_media_garbage() lista o que sobrou e a
--    função cleanup-expired-attachments (cron a cada 15 min) apaga pela API do Storage e remove os registros.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('announcement-media', 'announcement-media', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.announcement_media (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  path text not null unique,
  kind text not null check (kind in ('image', 'video')),
  mime text,
  size bigint,
  position int not null default 0,
  created_by uuid default public.get_current_profile_id(),
  created_at timestamptz not null default now()
);
create index if not exists announcement_media_ann on public.announcement_media(announcement_id, position);
alter table public.announcement_media enable row level security;

-- the author of the announcement (or an admin) manages its media, only while it has not expired
create or replace function public.can_edit_announcement_media(_ann uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.announcements a
    where a.id = _ann and public.same_company(a.company_id)
      and (a.author_id = public.get_current_profile_id() or public.is_admin() or public.has_autonomy_level('admin'))
      and (a.expire_at is null or a.expire_at > now())
  )
$$;
grant execute on function public.can_edit_announcement_media(uuid) to authenticated;

drop policy if exists "See media of visible announcements" on public.announcement_media;
create policy "See media of visible announcements" on public.announcement_media for select to authenticated
  using (exists (select 1 from public.announcements a where a.id = announcement_id));   -- announcements RLS decides
drop policy if exists "Author adds announcement media" on public.announcement_media;
create policy "Author adds announcement media" on public.announcement_media for insert to authenticated
  with check (public.can_edit_announcement_media(announcement_id)
    and exists (select 1 from public.announcements a where a.id = announcement_id and a.company_id = announcement_media.company_id
      and announcement_media.path like a.company_id::text || '/' || a.id::text || '/%'));
drop policy if exists "Author removes announcement media" on public.announcement_media;
create policy "Author removes announcement media" on public.announcement_media for delete to authenticated
  using (public.can_edit_announcement_media(announcement_id));
grant select, insert, delete on public.announcement_media to authenticated;

-- Storage: <empresa>/<aviso>/<arquivo>
drop policy if exists "Read announcement media" on storage.objects;
create policy "Read announcement media" on storage.objects for select to authenticated
  using (bucket_id = 'announcement-media' and exists (
    select 1 from public.announcements a
    where a.id::text = (storage.foldername(name))[2] and a.company_id::text = (storage.foldername(name))[1]));
drop policy if exists "Upload announcement media" on storage.objects;
create policy "Upload announcement media" on storage.objects for insert to authenticated
  with check (bucket_id = 'announcement-media'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.can_edit_announcement_media(((storage.foldername(name))[2])::uuid));
drop policy if exists "Delete announcement media" on storage.objects;
create policy "Delete announcement media" on storage.objects for delete to authenticated
  using (bucket_id = 'announcement-media'
    and (storage.foldername(name))[1] = public.current_company_id()::text
    and public.can_edit_announcement_media(((storage.foldername(name))[2])::uuid));

-- What the cleanup must delete: files of expired announcements and files whose announcement no longer exists.
create or replace function public.announcement_media_garbage(_limit int default 500)
returns table (path text) language sql stable security definer set search_path = public, storage as $$
  select o.name from storage.objects o
  where o.bucket_id = 'announcement-media'
    and not exists (
      select 1 from public.announcements a
      where a.id::text = (storage.foldername(o.name))[2] and (a.expire_at is null or a.expire_at > now()))
  limit greatest(1, least(_limit, 1000))
$$;
revoke all on function public.announcement_media_garbage(int) from public, anon, authenticated;
grant execute on function public.announcement_media_garbage(int) to service_role;
