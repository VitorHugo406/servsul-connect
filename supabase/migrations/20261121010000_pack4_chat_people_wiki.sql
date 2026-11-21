-- Competitive pack 4 (one migration = one approval). Everything is company-scoped and protected by RLS.
--  A. Chat: pinned messages, polls (also used in announcements), scheduled messages (cron every minute).
--     Conversation keys: 'sector:<id>', 'group:<id>', 'dm:<profileA>:<profileB>' (A < B, the same key for both people).
--  B. Avisos: read confirmation ("Li e concordo") + list of who has not confirmed, target sectors.
--  C. Agenda: public booking page (/agendar/<token>), meeting agenda/minutes with action items, room QR check-in.
--  D. Pessoas: time off (férias e ausências) with manager approval, climate/eNPS surveys (anonymous), 1:1 meetings,
--     praise/feedback, individual goals linked to evaluations, automatic onboarding switch.
--  E. Wiki (base de conhecimento) with versions and full-text search.
-- Notifications go to user_notifications (bell) with types booking, time_off, survey, one_on_one, feedback, goal.

-- ───────────── helpers
create or replace function public.is_sector_member(_sector uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (_sector = '00000000-0000-0000-0000-000000000001'::uuid or _sector = public.get_current_sector_id()
    or exists (select 1 from public.user_additional_sectors u where u.user_id = auth.uid() and u.sector_id = _sector))
$$;

create or replace function public.manages_profile(_profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and _profile is distinct from public.get_current_profile_id() and (
    public.is_admin() or public.is_team_manager_of(_profile)
    or exists (select 1 from public.profiles p join public.sectors s on s.id = p.sector_id
               where p.id = _profile and s.manager_id = public.get_current_profile_id() and public.same_company(p.company_id)))
$$;

create or replace function public.is_people_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (public.is_admin()
    or exists (select 1 from public.teams t where t.supervisor_id = auth.uid() and public.same_company(t.company_id))
    or exists (select 1 from public.supervisor_team_members s where s.supervisor_id = auth.uid())
    or exists (select 1 from public.sectors s where s.manager_id = public.get_current_profile_id()))
$$;

/** auth user ids to notify about a person's requests: team supervisors, sector manager; company admins as fallback. */
create or replace function public.manager_user_ids(_profile uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  with m as (
    select s.supervisor_id as u from public.supervisor_team_members s where s.member_profile_id = _profile
    union select t.supervisor_id from public.team_members tm join public.teams t on t.id = tm.team_id where tm.profile_id = _profile
    union select mp.user_id from public.profiles p join public.sectors s on s.id = p.sector_id join public.profiles mp on mp.id = s.manager_id
          where p.id = _profile and mp.id <> _profile
  )
  select u from m where u is not null
  union
  select ur.user_id from public.user_roles ur join public.profiles ap on ap.user_id = ur.user_id join public.profiles p on p.id = _profile
  where ur.role = 'admin' and ap.company_id = p.company_id and ap.is_active and ap.id <> _profile
    and not exists (select 1 from m where u is not null)
$$;

create or replace function public.notify_user(_user uuid, _type text, _title text, _message text, _ref uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _user is null then return; end if;
  insert into public.user_notifications(user_id, type, title, message, reference_id) values (_user, _type, left(_title, 120), left(_message, 500), _ref);
exception when others then null;
end $$;
revoke all on function public.notify_user(uuid, text, text, text, uuid) from public, anon, authenticated;

create or replace function public.profile_name(_profile uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(display_name, ''), name, 'Colaborador') from public.profiles where id = _profile
$$;

-- ───────────── A. chat
create or replace function public.chat_key_access(_key text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare k text[] := string_to_array(_key, ':'); me uuid := public.get_current_profile_id(); v uuid; a uuid; b uuid;
begin
  if me is null or _key is null then return false; end if;
  if k[1] = 'sector' and array_length(k, 1) = 2 then
    v := k[2]::uuid;
    return (v = '00000000-0000-0000-0000-000000000001'::uuid or exists (select 1 from public.sectors s where s.id = v and s.company_id = public.current_company_id()))
      and (public.is_sector_member(v) or public.is_admin());
  elsif k[1] = 'group' and array_length(k, 1) = 2 then
    v := k[2]::uuid;
    return public.is_group_member(v) and exists (select 1 from public.private_groups g where g.id = v and g.company_id = public.current_company_id());
  elsif k[1] = 'dm' and array_length(k, 1) = 3 then
    a := k[2]::uuid; b := k[3]::uuid;
    if me <> a and me <> b then return false; end if;
    return not exists (select 1 from public.profiles p where p.id in (a, b) and p.company_id is distinct from public.current_company_id());
  end if;
  return false;
exception when others then return false;
end $$;

create table if not exists public.chat_pins (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  conv_key text not null,
  message_id uuid not null,
  preview text not null default '',
  author_name text,
  message_at timestamptz,
  pinned_by uuid default public.get_current_profile_id(),
  created_at timestamptz not null default now(),
  unique (company_id, conv_key, message_id)
);
alter table public.chat_pins enable row level security;
drop policy if exists "Participants see pins" on public.chat_pins;
create policy "Participants see pins" on public.chat_pins for select to authenticated using (public.same_company(company_id) and public.chat_key_access(conv_key));
drop policy if exists "Participants pin" on public.chat_pins;
create policy "Participants pin" on public.chat_pins for insert to authenticated
  with check (public.same_company(company_id) and public.chat_key_access(conv_key) and pinned_by = public.get_current_profile_id()
    and (select count(*) from public.chat_pins x where x.company_id = chat_pins.company_id and x.conv_key = chat_pins.conv_key) < 20);
drop policy if exists "Participants unpin" on public.chat_pins;
create policy "Participants unpin" on public.chat_pins for delete to authenticated using (public.same_company(company_id) and public.chat_key_access(conv_key));
grant select, insert, delete on public.chat_pins to authenticated;

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  context text not null check (context in ('chat', 'announcement')),
  context_key text not null,
  question text not null check (length(trim(question)) between 1 and 300),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10),
  multi boolean not null default false,
  anonymous boolean not null default false,
  closes_at timestamptz,
  created_by uuid not null default public.get_current_profile_id() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists polls_ctx on public.polls(company_id, context, context_key);
create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  option_idx integer not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, profile_id, option_idx)
);

create or replace function public.poll_access(_context text, _key text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if _context = 'chat' then return public.chat_key_access(_key); end if;
  if _context = 'announcement' then
    return exists (select 1 from public.announcements a where a.id = _key::uuid and public.same_company(a.company_id)
      and public.announcement_visible(a.target_sectors, a.author_id));
  end if;
  return false;
exception when others then return false;
end $$;

alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
-- (announcement_visible is created in section B; the policies below are evaluated only at query time)

create or replace function public.poll_vote(_poll uuid, _options integer[])
returns void language plpgsql security definer set search_path = public as $$
declare p public.polls; me uuid := public.get_current_profile_id(); n integer;
begin
  select * into p from public.polls where id = _poll;
  if p.id is null or me is null or not public.same_company(p.company_id) or not public.poll_access(p.context, p.context_key) then raise exception 'not allowed'; end if;
  if p.closes_at is not null and p.closes_at < now() then raise exception 'POLL_CLOSED:'; end if;
  n := jsonb_array_length(p.options);
  if exists (select 1 from unnest(coalesce(_options, '{}')) o where o < 0 or o >= n) then raise exception 'POLL_BAD_OPTION:'; end if;
  if not p.multi and coalesce(cardinality(_options), 0) > 1 then raise exception 'POLL_ONE_OPTION:'; end if;
  delete from public.poll_votes where poll_id = _poll and profile_id = me;
  insert into public.poll_votes(poll_id, profile_id, option_idx) select distinct _poll, me, o from unnest(coalesce(_options, '{}')) o;
end $$;
revoke all on function public.poll_vote(uuid, integer[]) from public, anon;
grant execute on function public.poll_vote(uuid, integer[]) to authenticated;

create or replace function public.poll_results(_poll uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.polls; me uuid := public.get_current_profile_id();
begin
  select * into p from public.polls where id = _poll;
  if p.id is null or not public.same_company(p.company_id) or not public.poll_access(p.context, p.context_key) then return null; end if;
  return jsonb_build_object(
    'id', p.id, 'question', p.question, 'options', p.options, 'multi', p.multi, 'anonymous', p.anonymous, 'closes_at', p.closes_at,
    'closed', p.closes_at is not null and p.closes_at < now(), 'created_by', p.created_by, 'author', public.profile_name(p.created_by),
    'counts', (select coalesce(jsonb_agg(c order by i), '[]'::jsonb) from (
        select i, (select count(*) from public.poll_votes v where v.poll_id = _poll and v.option_idx = i) as c
        from generate_series(0, jsonb_array_length(p.options) - 1) i) x),
    'voters', (select count(distinct profile_id) from public.poll_votes where poll_id = _poll),
    'mine', (select coalesce(jsonb_agg(option_idx order by option_idx), '[]'::jsonb) from public.poll_votes where poll_id = _poll and profile_id = me),
    'names', case when p.anonymous then null else (select coalesce(jsonb_object_agg(i::text, names), '{}'::jsonb) from (
        select v.option_idx as i, jsonb_agg(public.profile_name(v.profile_id) order by v.created_at) as names
        from public.poll_votes v where v.poll_id = _poll group by v.option_idx) y) end);
end $$;
revoke all on function public.poll_results(uuid) from public, anon;
grant execute on function public.poll_results(uuid) to authenticated;

create or replace function public.poll_close(_poll uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.polls set closes_at = now() where id = _poll and (created_by = public.get_current_profile_id() or public.is_admin()) and public.same_company(company_id);
end $$;
revoke all on function public.poll_close(uuid) from public, anon;
grant execute on function public.poll_close(uuid) to authenticated;

create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  conv_key text not null,
  content text not null check (length(trim(content)) between 1 and 4000),
  send_at timestamptz not null,
  created_by uuid not null default public.get_current_profile_id() references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled', 'failed')),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists scheduled_messages_due on public.scheduled_messages(status, send_at);
alter table public.scheduled_messages enable row level security;
drop policy if exists "Own scheduled messages" on public.scheduled_messages;
create policy "Own scheduled messages" on public.scheduled_messages for select to authenticated using (created_by = public.get_current_profile_id());
drop policy if exists "Schedule a message" on public.scheduled_messages;
create policy "Schedule a message" on public.scheduled_messages for insert to authenticated
  with check (created_by = public.get_current_profile_id() and public.same_company(company_id) and status = 'pending'
    and send_at > now() and send_at < now() + interval '366 days' and public.chat_key_access(conv_key));
drop policy if exists "Edit own pending" on public.scheduled_messages;
create policy "Edit own pending" on public.scheduled_messages for update to authenticated
  using (created_by = public.get_current_profile_id() and status = 'pending')
  with check (created_by = public.get_current_profile_id() and status in ('pending', 'cancelled') and send_at > now() - interval '1 minute');
drop policy if exists "Delete own" on public.scheduled_messages;
create policy "Delete own" on public.scheduled_messages for delete to authenticated using (created_by = public.get_current_profile_id() and status <> 'pending');
grant select, insert, update, delete on public.scheduled_messages to authenticated;

create or replace function public.send_scheduled_messages()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; k text[]; n integer := 0; pr record; other uuid; v uuid;
begin
  for r in select * from public.scheduled_messages where status = 'pending' and send_at <= now() order by send_at limit 300 loop
    begin
      select p.id, p.user_id, p.company_id, p.sector_id, p.is_active into pr from public.profiles p where p.id = r.created_by;
      if pr.id is null or not coalesce(pr.is_active, false) or pr.company_id is distinct from r.company_id then raise exception 'author inactive'; end if;
      k := string_to_array(r.conv_key, ':');
      if k[1] = 'sector' then
        v := k[2]::uuid;
        if not (v = '00000000-0000-0000-0000-000000000001'::uuid or v = pr.sector_id
                or exists (select 1 from public.user_additional_sectors u where u.user_id = pr.user_id and u.sector_id = v)
                or exists (select 1 from public.user_roles ur where ur.user_id = pr.user_id and ur.role = 'admin')) then raise exception 'no access'; end if;
        insert into public.messages(content, author_id, sector_id, company_id) values (r.content, pr.id, v, pr.company_id);
      elsif k[1] = 'group' then
        v := k[2]::uuid;
        if not exists (select 1 from public.private_group_members m where m.group_id = v and m.profile_id = pr.id) then raise exception 'no access'; end if;
        insert into public.private_group_messages(group_id, sender_id, content) values (v, pr.id, r.content);
      elsif k[1] = 'dm' then
        other := case when k[2]::uuid = pr.id then k[3]::uuid else k[2]::uuid end;
        if pr.id not in (k[2]::uuid, k[3]::uuid) then raise exception 'no access'; end if;
        insert into public.direct_messages(sender_id, receiver_id, content, company_id) values (pr.id, other, r.content, pr.company_id);
      else raise exception 'bad key';
      end if;
      update public.scheduled_messages set status = 'sent', sent_at = now(), error = null where id = r.id;
      n := n + 1;
    exception when others then
      update public.scheduled_messages set status = 'failed', error = left(sqlerrm, 300) where id = r.id;
    end;
  end loop;
  return n;
end $$;
revoke all on function public.send_scheduled_messages() from public, anon, authenticated;

-- ───────────── B. avisos
alter table public.announcements add column if not exists require_ack boolean not null default false;
alter table public.announcements add column if not exists target_sectors uuid[];

create or replace function public.announcement_visible(_targets uuid[], _author uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _targets is null or cardinality(_targets) = 0 or _author = public.get_current_profile_id() or public.is_admin()
    or exists (select 1 from unnest(_targets) t where public.is_sector_member(t))
$$;

drop policy if exists "Same company can view announcements" on public.announcements;
create policy "Same company can view announcements" on public.announcements for select
  using (((select auth.uid()) is not null) and public.same_company(company_id) and public.announcement_visible(target_sectors, author_id));

create table if not exists public.announcement_acks (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  profile_id uuid not null default public.get_current_profile_id() references public.profiles(id) on delete cascade,
  acked_at timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);
alter table public.announcement_acks enable row level security;
drop policy if exists "See own or as author" on public.announcement_acks;
create policy "See own or as author" on public.announcement_acks for select to authenticated
  using (profile_id = public.get_current_profile_id() or exists (select 1 from public.announcements a where a.id = announcement_id
         and public.same_company(a.company_id) and (a.author_id = public.get_current_profile_id() or public.is_admin())));
drop policy if exists "Confirm reading" on public.announcement_acks;
create policy "Confirm reading" on public.announcement_acks for insert to authenticated
  with check (profile_id = public.get_current_profile_id() and exists (select 1 from public.announcements a where a.id = announcement_id
              and public.same_company(a.company_id) and a.require_ack and public.announcement_visible(a.target_sectors, a.author_id)));
grant select, insert on public.announcement_acks to authenticated;

/** Who must confirm an announcement and whether they did (author/admin only). */
create or replace function public.announcement_ack_status(_id uuid)
returns table (profile_id uuid, name text, sector text, avatar_url text, acked_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare a public.announcements;
begin
  select * into a from public.announcements where id = _id;
  if a.id is null or not public.same_company(a.company_id) or not (a.author_id = public.get_current_profile_id() or public.is_admin()) then return; end if;
  return query
    select p.id, coalesce(nullif(p.display_name, ''), p.name), s.name, p.avatar_url, k.acked_at
    from public.profiles p left join public.sectors s on s.id = p.sector_id
    left join public.announcement_acks k on k.announcement_id = _id and k.profile_id = p.id
    where p.company_id = a.company_id and p.is_active and coalesce(p.profile_type, 'user') <> 'system'
      and (a.target_sectors is null or cardinality(a.target_sectors) = 0 or p.sector_id = any(a.target_sectors)
           or '00000000-0000-0000-0000-000000000001'::uuid = any(a.target_sectors)
           or exists (select 1 from public.user_additional_sectors u where u.user_id = p.user_id and u.sector_id = any(a.target_sectors)))
    order by k.acked_at nulls first, 2;
end $$;
revoke all on function public.announcement_ack_status(uuid) from public, anon;
grant execute on function public.announcement_ack_status(uuid) to authenticated;

-- polls policies (need announcement_visible)
drop policy if exists "See polls" on public.polls;
create policy "See polls" on public.polls for select to authenticated using (public.same_company(company_id) and public.poll_access(context, context_key));
drop policy if exists "Create polls" on public.polls;
create policy "Create polls" on public.polls for insert to authenticated
  with check (created_by = public.get_current_profile_id() and public.same_company(company_id) and public.poll_access(context, context_key)
    and (context <> 'announcement' or exists (select 1 from public.announcements a where a.id::text = context_key
         and (a.author_id = public.get_current_profile_id() or public.is_admin()))));
drop policy if exists "Delete own polls" on public.polls;
create policy "Delete own polls" on public.polls for delete to authenticated using (public.same_company(company_id) and (created_by = public.get_current_profile_id() or public.is_admin()));
drop policy if exists "Own votes" on public.poll_votes;
create policy "Own votes" on public.poll_votes for select to authenticated using (profile_id = public.get_current_profile_id());
grant select, insert, delete on public.polls to authenticated;
grant select on public.poll_votes to authenticated;

-- ───────────── C. agenda
create table if not exists public.booking_pages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  profile_id uuid not null unique default public.get_current_profile_id() references public.profiles(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  enabled boolean not null default true,
  title text not null default 'Reunião' check (length(trim(title)) between 1 and 120),
  intro text check (intro is null or length(intro) <= 1000),
  duration_min integer not null default 30 check (duration_min in (15, 20, 30, 45, 60, 90, 120)),
  weekdays integer[] not null default '{1,2,3,4,5}',
  start_time time not null default '09:00',
  end_time time not null default '18:00',
  buffer_min integer not null default 0 check (buffer_min between 0 and 120),
  min_notice_hours integer not null default 2 check (min_notice_hours between 0 and 168),
  max_days_ahead integer not null default 30 check (max_days_ahead between 1 and 90),
  meeting_link text check (meeting_link is null or meeting_link ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
alter table public.booking_pages enable row level security;
drop policy if exists "Own booking page" on public.booking_pages;
create policy "Own booking page" on public.booking_pages for all to authenticated
  using (profile_id = public.get_current_profile_id()) with check (profile_id = public.get_current_profile_id() and public.same_company(company_id));
grant select, insert, update, delete on public.booking_pages to authenticated;

create table if not exists public.public_bookings (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.booking_pages(id) on delete cascade,
  event_id uuid references public.calendar_events(id) on delete set null,
  guest_name text not null,
  guest_email text not null,
  guest_note text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists public_bookings_page on public.public_bookings(page_id, created_at desc);
alter table public.public_bookings enable row level security;
drop policy if exists "Owner sees bookings" on public.public_bookings;
create policy "Owner sees bookings" on public.public_bookings for select to authenticated
  using (exists (select 1 from public.booking_pages b where b.id = page_id and b.profile_id = public.get_current_profile_id()));
grant select on public.public_bookings to authenticated;

create or replace function public.booking_free_slots(_page public.booking_pages)
returns setof timestamptz language plpgsql stable security definer set search_path = public as $$
declare uid uuid; d date; m integer; endm integer; s timestamptz; e timestamptz; today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select user_id into uid from public.profiles where id = _page.profile_id;
  endm := (extract(epoch from _page.end_time) / 60)::int;
  for d in select generate_series(today, today + _page.max_days_ahead, interval '1 day')::date loop
    if not (extract(isodow from d)::int = any(_page.weekdays)) then continue; end if;
    m := (extract(epoch from _page.start_time) / 60)::int;   -- minutes since midnight (time + interval would wrap at 24h)
    while m + _page.duration_min <= endm loop
      s := (d + make_interval(mins => m)) at time zone 'America/Sao_Paulo'; e := s + make_interval(mins => _page.duration_min);
      if s >= now() + make_interval(hours => _page.min_notice_hours)
         and not exists (select 1 from public.calendar_events ce where ce.company_id = _page.company_id
               and (ce.created_by = uid or exists (select 1 from public.meeting_participants mp where mp.event_id = ce.id and mp.profile_id = _page.profile_id))
               and ce.start_date < e + make_interval(mins => _page.buffer_min) and coalesce(ce.end_date, ce.start_date + interval '1 hour') > s - make_interval(mins => _page.buffer_min))
         and not exists (select 1 from public.meeting_bookings mb where mb.company_id = _page.company_id
               and (mb.booked_by = _page.profile_id or exists (select 1 from public.meeting_booking_participants bp where bp.booking_id = mb.id and bp.profile_id = _page.profile_id))
               and mb.starts_at < e + make_interval(mins => _page.buffer_min) and mb.ends_at > s - make_interval(mins => _page.buffer_min))
      then return next s; end if;
      m := m + _page.duration_min + _page.buffer_min;
    end loop;
  end loop;
end $$;
revoke all on function public.booking_free_slots(public.booking_pages) from public, anon, authenticated;

create or replace function public.public_booking_view(_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare b public.booking_pages; who record; co text;
begin
  select * into b from public.booking_pages where token = _token and enabled;
  if b.id is null then return null; end if;
  select coalesce(nullif(p.display_name, ''), p.name) as name, p.avatar_url, p.is_active into who from public.profiles p where p.id = b.profile_id;
  if not coalesce(who.is_active, false) then return null; end if;
  select name into co from public.companies where id = b.company_id and is_active and not coalesce(is_suspended, false);
  if co is null then return null; end if;
  return jsonb_build_object('title', b.title, 'intro', b.intro, 'duration', b.duration_min, 'host', who.name, 'avatar', who.avatar_url, 'company', co,
    'slots', (select coalesce(jsonb_agg(s order by s), '[]'::jsonb) from public.booking_free_slots(b) s));
end $$;
grant execute on function public.public_booking_view(text) to anon, authenticated;

create or replace function public.public_booking_create(_token text, _start timestamptz, _name text, _email text, _note text default null, _hp text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.booking_pages; uid uuid; ev uuid; e timestamptz; n integer;
begin
  if coalesce(_hp, '') <> '' then return jsonb_build_object('ok', true); end if;
  select * into b from public.booking_pages where token = _token and enabled;
  if b.id is null then raise exception 'BOOKING_CLOSED:'; end if;
  if length(trim(coalesce(_name, ''))) < 2 or coalesce(_email, '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'BOOKING_DATA:'; end if;
  select count(*) into n from public.public_bookings where page_id = b.id and created_at > now() - interval '1 day';
  if n >= 30 then raise exception 'BOOKING_LIMIT:'; end if;
  select count(*) into n from public.public_bookings where page_id = b.id and lower(guest_email) = lower(_email) and created_at > now() - interval '1 day';
  if n >= 3 then raise exception 'BOOKING_LIMIT:'; end if;
  perform pg_advisory_xact_lock(hashtext('booking:' || b.id::text));
  if not exists (select 1 from public.booking_free_slots(b) s where s = _start) then raise exception 'BOOKING_TAKEN:'; end if;
  e := _start + make_interval(mins => b.duration_min);
  select user_id into uid from public.profiles where id = b.profile_id;
  insert into public.calendar_events(title, description, event_type, start_date, end_date, all_day, color, reminder_minutes, created_by, company_id, meeting_link)
  values (left(b.title || ' — ' || trim(_name), 200), 'Agendado pelo link público por ' || trim(_name) || ' (' || lower(trim(_email)) || ')' || coalesce(E'\n\n' || left(_note, 1000), ''),
          'meeting', _start, e, false, '#2358C3', 15, uid, b.company_id, b.meeting_link)
  returning id into ev;
  insert into public.public_bookings(page_id, event_id, guest_name, guest_email, guest_note, starts_at, ends_at)
  values (b.id, ev, left(trim(_name), 120), left(lower(trim(_email)), 200), left(_note, 1000), _start, e);
  perform public.notify_user(uid, 'booking', 'Novo agendamento', trim(_name) || ' agendou "' || b.title || '" para ' || to_char(_start at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), ev);
  return jsonb_build_object('ok', true, 'start', _start, 'end', e, 'link', b.meeting_link);
end $$;
grant execute on function public.public_booking_create(text, timestamptz, text, text, text, text) to anon, authenticated;

create table if not exists public.meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  kind text not null check (kind in ('event', 'booking')),
  ref_id uuid not null,
  agenda text check (agenda is null or length(agenda) <= 20000),
  minutes text check (minutes is null or length(minutes) <= 50000),
  actions jsonb not null default '[]'::jsonb,
  updated_by uuid default public.get_current_profile_id(),
  updated_at timestamptz not null default now(),
  unique (kind, ref_id)
);
alter table public.meeting_minutes enable row level security;
create or replace function public.meeting_ref_visible(_kind text, _ref uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if _kind = 'event' then
    return exists (select 1 from public.calendar_events ce where ce.id = _ref and public.same_company(ce.company_id) and public.can_view_calendar_event(ce.id, ce.created_by));
  elsif _kind = 'booking' then
    return exists (select 1 from public.meeting_bookings mb where mb.id = _ref and public.same_company(mb.company_id)
      and (mb.booked_by = public.get_current_profile_id() or public.is_admin()
           or exists (select 1 from public.meeting_booking_participants bp where bp.booking_id = mb.id and bp.profile_id = public.get_current_profile_id())));
  end if;
  return false;
end $$;
drop policy if exists "Participants use minutes" on public.meeting_minutes;
create policy "Participants use minutes" on public.meeting_minutes for all to authenticated
  using (public.same_company(company_id) and public.meeting_ref_visible(kind, ref_id))
  with check (public.same_company(company_id) and public.meeting_ref_visible(kind, ref_id));
grant select, insert, update, delete on public.meeting_minutes to authenticated;

alter table public.meeting_rooms add column if not exists checkin_token text unique default encode(extensions.gen_random_bytes(10), 'hex');
update public.meeting_rooms set checkin_token = encode(extensions.gen_random_bytes(10), 'hex') where checkin_token is null;
create table if not exists public.room_checkins (
  booking_id uuid not null references public.meeting_bookings(id) on delete cascade,
  profile_id uuid not null default public.get_current_profile_id() references public.profiles(id) on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (booking_id, profile_id)
);
alter table public.room_checkins enable row level security;
drop policy if exists "See checkins" on public.room_checkins;
create policy "See checkins" on public.room_checkins for select to authenticated
  using (exists (select 1 from public.meeting_bookings mb where mb.id = booking_id and public.same_company(mb.company_id)));
grant select on public.room_checkins to authenticated;

create or replace function public.room_checkin(_token text, _do boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.meeting_rooms; b public.meeting_bookings; nx public.meeting_bookings; me uuid := public.get_current_profile_id(); n integer;
begin
  select * into r from public.meeting_rooms where checkin_token = _token;
  if r.id is null or not public.same_company(r.company_id) then raise exception 'ROOM_NOT_FOUND:'; end if;
  select * into b from public.meeting_bookings where room_id = r.id and starts_at - interval '15 minutes' <= now() and ends_at > now() order by starts_at limit 1;
  select * into nx from public.meeting_bookings where room_id = r.id and starts_at > now() and id is distinct from b.id order by starts_at limit 1;
  if b.id is not null and _do then
    insert into public.room_checkins(booking_id, profile_id) values (b.id, me) on conflict do nothing;
  end if;
  select count(*) into n from public.room_checkins where booking_id = b.id;
  return jsonb_build_object('room', r.name, 'capacity', r.capacity,
    'current', case when b.id is null then null else jsonb_build_object('id', b.id, 'title', b.title, 'starts_at', b.starts_at, 'ends_at', b.ends_at,
      'host', public.profile_name(b.booked_by), 'checked', n,
      'me', exists (select 1 from public.room_checkins c where c.booking_id = b.id and c.profile_id = me)) end,
    'next', case when nx.id is null then null else jsonb_build_object('title', nx.title, 'starts_at', nx.starts_at, 'ends_at', nx.ends_at) end);
end $$;
revoke all on function public.room_checkin(text, boolean) from public, anon;
grant execute on function public.room_checkin(text, boolean) to authenticated;

-- ───────────── D. pessoas
create table if not exists public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  profile_id uuid not null default public.get_current_profile_id() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('ferias', 'folga', 'atestado', 'licenca', 'home_office', 'outro')),
  start_date date not null,
  end_date date not null,
  note text check (note is null or length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or length(decision_note) <= 1000),
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 366)
);
create index if not exists time_off_company on public.time_off_requests(company_id, start_date);
alter table public.time_off_requests enable row level security;
drop policy if exists "Own or managed time off" on public.time_off_requests;
create policy "Own or managed time off" on public.time_off_requests for select to authenticated
  using (public.same_company(company_id) and (profile_id = public.get_current_profile_id() or public.manages_profile(profile_id)));
drop policy if exists "Request time off" on public.time_off_requests;
create policy "Request time off" on public.time_off_requests for insert to authenticated
  with check (profile_id = public.get_current_profile_id() and public.same_company(company_id) and status = 'pending' and decided_by is null);
grant select, insert on public.time_off_requests to authenticated;

create or replace function public.time_off_label(_k text) returns text language sql immutable as $$
  select case _k when 'ferias' then 'Férias' when 'folga' then 'Folga' when 'atestado' then 'Atestado' when 'licenca' then 'Licença'
    when 'home_office' then 'Home office' else 'Ausência' end $$;

create or replace function public.time_off_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  for u in select * from public.manager_user_ids(new.profile_id) loop
    perform public.notify_user(u, 'time_off', 'Pedido de ' || lower(public.time_off_label(new.kind)),
      public.profile_name(new.profile_id) || ' pediu ' || lower(public.time_off_label(new.kind)) || ' de ' || to_char(new.start_date, 'DD/MM') || ' a ' || to_char(new.end_date, 'DD/MM/YYYY'), new.id);
  end loop;
  return new;
end $$;
drop trigger if exists time_off_after_insert on public.time_off_requests;
create trigger time_off_after_insert after insert on public.time_off_requests for each row execute function public.time_off_after_insert();

create or replace function public.time_off_decide(_id uuid, _approve boolean, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare t public.time_off_requests; u uuid;
begin
  select * into t from public.time_off_requests where id = _id for update;
  if t.id is null or not public.same_company(t.company_id) or not public.manages_profile(t.profile_id) then raise exception 'not allowed'; end if;
  if t.status <> 'pending' then raise exception 'TIMEOFF_CLOSED:'; end if;
  update public.time_off_requests set status = case when _approve then 'approved' else 'rejected' end, decided_by = public.get_current_profile_id(),
    decided_at = now(), decision_note = nullif(left(coalesce(_note, ''), 1000), '') where id = _id;
  select user_id into u from public.profiles where id = t.profile_id;
  perform public.notify_user(u, 'time_off', case when _approve then 'Pedido aprovado' else 'Pedido recusado' end,
    public.time_off_label(t.kind) || ' de ' || to_char(t.start_date, 'DD/MM') || ' a ' || to_char(t.end_date, 'DD/MM/YYYY') ||
    case when _approve then ' aprovado' else ' recusado' end || ' por ' || public.profile_name(public.get_current_profile_id()) || coalesce(': ' || nullif(left(_note, 200), ''), ''), t.id);
end $$;
revoke all on function public.time_off_decide(uuid, boolean, text) from public, anon;
grant execute on function public.time_off_decide(uuid, boolean, text) to authenticated;

create or replace function public.time_off_cancel(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.time_off_requests set status = 'cancelled', decided_at = now()
  where id = _id and profile_id = public.get_current_profile_id() and (status = 'pending' or (status = 'approved' and start_date > current_date));
end $$;
revoke all on function public.time_off_cancel(uuid) from public, anon;
grant execute on function public.time_off_cancel(uuid) to authenticated;

/** Approved absences of the company in a period, for the team calendar. Colleagues see only "Ausente"; the person,
 *  their managers and admins see the kind. */
create or replace function public.company_absences(_from date, _to date)
returns table (id uuid, profile_id uuid, name text, avatar_url text, sector text, kind text, start_date date, end_date date)
language sql stable security definer set search_path = public as $$
  select t.id, t.profile_id, coalesce(nullif(p.display_name, ''), p.name), p.avatar_url, s.name,
    case when t.profile_id = public.get_current_profile_id() or public.manages_profile(t.profile_id) then t.kind else 'ausente' end,
    t.start_date, t.end_date
  from public.time_off_requests t join public.profiles p on p.id = t.profile_id left join public.sectors s on s.id = p.sector_id
  where t.company_id = public.current_company_id() and t.status = 'approved' and t.start_date <= _to and t.end_date >= _from and p.is_active
  order by t.start_date
$$;
revoke all on function public.company_absences(date, date) from public, anon;
grant execute on function public.company_absences(date, date) to authenticated;

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  intro text check (intro is null or length(intro) <= 2000),
  kind text not null default 'clima' check (kind in ('enps', 'clima', 'custom')),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 40),
  target_sectors uuid[],
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  closes_at timestamptz,
  created_by uuid not null default public.get_current_profile_id() references public.profiles(id) on delete cascade,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.surveys enable row level security;
drop policy if exists "See surveys" on public.surveys;
create policy "See surveys" on public.surveys for select to authenticated
  using (public.same_company(company_id) and (created_by = public.get_current_profile_id() or public.is_admin()
         or (status <> 'draft' and (target_sectors is null or cardinality(target_sectors) = 0 or exists (select 1 from unnest(target_sectors) s where public.is_sector_member(s))))));
drop policy if exists "Managers create surveys" on public.surveys;
create policy "Managers create surveys" on public.surveys for insert to authenticated
  with check (public.same_company(company_id) and created_by = public.get_current_profile_id() and public.is_people_manager());
drop policy if exists "Owners edit surveys" on public.surveys;
create policy "Owners edit surveys" on public.surveys for update to authenticated
  using (public.same_company(company_id) and (created_by = public.get_current_profile_id() or public.is_admin()))
  with check (public.same_company(company_id));
drop policy if exists "Owners delete surveys" on public.surveys;
create policy "Owners delete surveys" on public.surveys for delete to authenticated
  using (public.same_company(company_id) and (created_by = public.get_current_profile_id() or public.is_admin()));
grant select, insert, update, delete on public.surveys to authenticated;

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  answers jsonb not null,
  sector_id uuid,
  created_at timestamptz not null default date_trunc('day', now())   -- day only, to make timing correlation harder
);
create table if not exists public.survey_participants (
  survey_id uuid not null references public.surveys(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (survey_id, profile_id)
);
alter table public.survey_responses enable row level security;   -- no policies: only through the functions below
alter table public.survey_participants enable row level security;
drop policy if exists "Own participation" on public.survey_participants;
create policy "Own participation" on public.survey_participants for select to authenticated using (profile_id = public.get_current_profile_id());
grant select on public.survey_participants to authenticated;

create or replace function public.surveys_open_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'open' then return new; end if;
  end if;
  if new.status = 'open' then
    new.opened_at := coalesce(new.opened_at, now());
    for u in select p.user_id from public.profiles p where p.company_id = new.company_id and p.is_active and coalesce(p.profile_type, 'user') <> 'system'
          and p.user_id is not null and (new.target_sectors is null or cardinality(new.target_sectors) = 0 or p.sector_id = any(new.target_sectors)
            or '00000000-0000-0000-0000-000000000001'::uuid = any(new.target_sectors)
            or exists (select 1 from public.user_additional_sectors a where a.user_id = p.user_id and a.sector_id = any(new.target_sectors))) loop
      perform public.notify_user(u, 'survey', 'Nova pesquisa', '"' || new.title || '" — sua resposta é anônima.', new.id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists surveys_open_notify on public.surveys;
create trigger surveys_open_notify before insert or update of status on public.surveys for each row execute function public.surveys_open_notify();

create or replace function public.survey_submit(_id uuid, _answers jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare s public.surveys; me uuid := public.get_current_profile_id(); sec uuid;
begin
  select * into s from public.surveys where id = _id;
  if s.id is null or not public.same_company(s.company_id) or s.status <> 'open' or (s.closes_at is not null and s.closes_at < now()) then raise exception 'SURVEY_CLOSED:'; end if;
  if not (s.target_sectors is null or cardinality(s.target_sectors) = 0 or exists (select 1 from unnest(s.target_sectors) t where public.is_sector_member(t))) then raise exception 'not allowed'; end if;
  if jsonb_typeof(_answers) <> 'object' or length(_answers::text) > 50000 then raise exception 'SURVEY_DATA:'; end if;
  insert into public.survey_participants(survey_id, profile_id) values (_id, me);   -- fails if already answered
  select sector_id into sec from public.profiles where id = me;
  insert into public.survey_responses(survey_id, answers, sector_id) values (_id, _answers, sec);
exception when unique_violation then raise exception 'SURVEY_ANSWERED:';
end $$;
revoke all on function public.survey_submit(uuid, jsonb) from public, anon;
grant execute on function public.survey_submit(uuid, jsonb) to authenticated;

/** Aggregated results (owner/admin). Nothing is shown below 3 answers; text answers come shuffled; sector breakdown
 *  only for sectors with 5+ answers. */
create or replace function public.survey_results(_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.surveys; total integer; q jsonb; qid text; qt text; res jsonb := '[]'::jsonb; item jsonb; invited integer;
begin
  select * into s from public.surveys where id = _id;
  if s.id is null or not public.same_company(s.company_id) or not (s.created_by = public.get_current_profile_id() or public.is_admin()) then raise exception 'not allowed'; end if;
  select count(*) into total from public.survey_responses where survey_id = _id;
  select count(*) into invited from public.profiles p where p.company_id = s.company_id and p.is_active and coalesce(p.profile_type, 'user') <> 'system'
    and (s.target_sectors is null or cardinality(s.target_sectors) = 0 or p.sector_id = any(s.target_sectors) or '00000000-0000-0000-0000-000000000001'::uuid = any(s.target_sectors));
  if total < 3 then return jsonb_build_object('total', total, 'invited', invited, 'min', 3, 'questions', '[]'::jsonb); end if;
  for q in select value from jsonb_array_elements(s.questions) loop
    qid := q->>'id'; qt := q->>'type';
    if qt in ('enps', 'scale') then
      select jsonb_build_object('id', qid, 'type', qt, 'label', q->>'label', 'n', count(v), 'avg', round(avg(v), 2),
        'promoters', count(*) filter (where v >= 9), 'passives', count(*) filter (where v between 7 and 8), 'detractors', count(*) filter (where v <= 6),
        'score', case when qt = 'enps' and count(v) > 0 then round(100.0 * (count(*) filter (where v >= 9) - count(*) filter (where v <= 6)) / count(v)) end,
        'dist', (select jsonb_agg(jsonb_build_object('v', g, 'n', (select count(*) from public.survey_responses r2 where r2.survey_id = _id and (r2.answers->>qid) = g::text)) order by g)
                 from generate_series(case when qt = 'enps' then 0 else 1 end, case when qt = 'enps' then 10 else 5 end) g),
        'by_sector', (select coalesce(jsonb_agg(jsonb_build_object('sector', coalesce(sc.name, 'Sem setor'), 'n', x.n, 'avg', x.a, 'score', x.sc)), '[]'::jsonb) from (
            select r3.sector_id, count(*) n, round(avg((r3.answers->>qid)::numeric), 2) a,
              round(100.0 * (count(*) filter (where (r3.answers->>qid)::numeric >= 9) - count(*) filter (where (r3.answers->>qid)::numeric <= 6)) / count(*)) sc
            from public.survey_responses r3 where r3.survey_id = _id and (r3.answers->>qid) ~ '^[0-9]+$' group by r3.sector_id having count(*) >= 5) x
            left join public.sectors sc on sc.id = x.sector_id))
      into item
      from (select (r.answers->>qid)::numeric v from public.survey_responses r where r.survey_id = _id and (r.answers->>qid) ~ '^[0-9]+$') z;
    elsif qt = 'choice' then
      select jsonb_build_object('id', qid, 'type', qt, 'label', q->>'label', 'options', q->'options',
        'counts', (select jsonb_agg((select count(*) from public.survey_responses r where r.survey_id = _id and r.answers->>qid = o.value #>> '{}') order by o.i)
                   from jsonb_array_elements(q->'options') with ordinality o(value, i)))
      into item;
    else
      select jsonb_build_object('id', qid, 'type', 'text', 'label', q->>'label',
        'answers', (select coalesce(jsonb_agg(a order by random()), '[]'::jsonb) from (select r.answers->>qid a from public.survey_responses r
                    where r.survey_id = _id and length(trim(coalesce(r.answers->>qid, ''))) > 0) t))
      into item;
    end if;
    res := res || jsonb_build_array(item);
  end loop;
  return jsonb_build_object('total', total, 'invited', invited, 'min', 3, 'questions', res);
end $$;
revoke all on function public.survey_results(uuid) from public, anon;
grant execute on function public.survey_results(uuid) to authenticated;

create table if not exists public.one_on_ones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  manager_id uuid not null references public.profiles(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  agenda jsonb not null default '[]'::jsonb,
  shared_notes text check (shared_notes is null or length(shared_notes) <= 20000),
  action_items jsonb not null default '[]'::jsonb,
  created_by uuid default public.get_current_profile_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (manager_id <> employee_id)
);
create index if not exists one_on_ones_people on public.one_on_ones(company_id, manager_id, employee_id, scheduled_at desc);
alter table public.one_on_ones enable row level security;
drop policy if exists "Pair sees 1:1" on public.one_on_ones;
create policy "Pair sees 1:1" on public.one_on_ones for select to authenticated
  using (public.same_company(company_id) and (public.get_current_profile_id() in (manager_id, employee_id) or public.is_admin()));
drop policy if exists "Manager schedules 1:1" on public.one_on_ones;
create policy "Manager schedules 1:1" on public.one_on_ones for insert to authenticated
  with check (public.same_company(company_id) and manager_id = public.get_current_profile_id() and public.manages_profile(employee_id));
drop policy if exists "Pair edits 1:1" on public.one_on_ones;
create policy "Pair edits 1:1" on public.one_on_ones for update to authenticated
  using (public.same_company(company_id) and public.get_current_profile_id() in (manager_id, employee_id))
  with check (public.same_company(company_id) and public.get_current_profile_id() in (manager_id, employee_id));
drop policy if exists "Manager deletes 1:1" on public.one_on_ones;
create policy "Manager deletes 1:1" on public.one_on_ones for delete to authenticated using (public.same_company(company_id) and manager_id = public.get_current_profile_id());
grant select, insert, update, delete on public.one_on_ones to authenticated;

create table if not exists public.one_on_one_private_notes (
  one_on_one_id uuid not null references public.one_on_ones(id) on delete cascade,
  author_id uuid not null default public.get_current_profile_id() references public.profiles(id) on delete cascade,
  notes text check (notes is null or length(notes) <= 20000),
  updated_at timestamptz not null default now(),
  primary key (one_on_one_id, author_id)
);
alter table public.one_on_one_private_notes enable row level security;
drop policy if exists "Author only" on public.one_on_one_private_notes;
create policy "Author only" on public.one_on_one_private_notes for all to authenticated
  using (author_id = public.get_current_profile_id()) with check (author_id = public.get_current_profile_id());
grant select, insert, update, delete on public.one_on_one_private_notes to authenticated;

create or replace function public.one_on_one_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  select user_id into u from public.profiles where id = new.employee_id;
  perform public.notify_user(u, 'one_on_one', 'Reunião 1:1 marcada', public.profile_name(new.manager_id) || ' marcou uma 1:1 com você para '
    || to_char(new.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI') || '. Adicione os assuntos na pauta.', new.id);
  return new;
end $$;
create or replace function public.one_on_one_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.manager_id := old.manager_id; new.employee_id := old.employee_id; new.company_id := old.company_id;
  new.created_by := old.created_by; new.created_at := old.created_at; new.updated_at := now();
  return new;
end $$;
drop trigger if exists one_on_one_guard on public.one_on_ones;
create trigger one_on_one_guard before update on public.one_on_ones for each row execute function public.one_on_one_guard();
drop trigger if exists one_on_one_notify on public.one_on_ones;
create trigger one_on_one_notify after insert on public.one_on_ones for each row execute function public.one_on_one_notify();

create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  from_id uuid not null default public.get_current_profile_id() references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('elogio', 'feedback')),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  value_tag text check (value_tag is null or length(value_tag) <= 40),
  message text not null check (length(trim(message)) between 1 and 1500),
  created_at timestamptz not null default now(),
  check (from_id <> to_id),
  check (kind = 'elogio' or visibility = 'private')
);
create index if not exists feedbacks_company on public.feedbacks(company_id, created_at desc);
alter table public.feedbacks enable row level security;
drop policy if exists "See feedback" on public.feedbacks;
create policy "See feedback" on public.feedbacks for select to authenticated
  using (public.same_company(company_id) and (visibility = 'public' or public.get_current_profile_id() in (from_id, to_id) or public.manages_profile(to_id)));
drop policy if exists "Give feedback" on public.feedbacks;
create policy "Give feedback" on public.feedbacks for insert to authenticated
  with check (public.same_company(company_id) and from_id = public.get_current_profile_id()
    and exists (select 1 from public.profiles p where p.id = to_id and p.company_id = public.current_company_id() and p.is_active));
drop policy if exists "Delete own feedback" on public.feedbacks;
create policy "Delete own feedback" on public.feedbacks for delete to authenticated using (public.same_company(company_id) and (from_id = public.get_current_profile_id() or public.is_admin()));
grant select, insert, delete on public.feedbacks to authenticated;

create table if not exists public.feedback_cheers (
  feedback_id uuid not null references public.feedbacks(id) on delete cascade,
  profile_id uuid not null default public.get_current_profile_id() references public.profiles(id) on delete cascade,
  primary key (feedback_id, profile_id)
);
alter table public.feedback_cheers enable row level security;
drop policy if exists "Cheers" on public.feedback_cheers;
create policy "Cheers" on public.feedback_cheers for select to authenticated using (exists (select 1 from public.feedbacks f where f.id = feedback_id));
drop policy if exists "Cheer" on public.feedback_cheers;
create policy "Cheer" on public.feedback_cheers for insert to authenticated with check (profile_id = public.get_current_profile_id() and exists (select 1 from public.feedbacks f where f.id = feedback_id and f.visibility = 'public'));
drop policy if exists "Uncheer" on public.feedback_cheers;
create policy "Uncheer" on public.feedback_cheers for delete to authenticated using (profile_id = public.get_current_profile_id());
grant select, insert, delete on public.feedback_cheers to authenticated;

create or replace function public.feedback_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  select user_id into u from public.profiles where id = new.to_id;
  perform public.notify_user(u, 'feedback', case when new.kind = 'elogio' then 'Você recebeu um elogio' else 'Você recebeu um feedback' end,
    public.profile_name(new.from_id) || ': "' || left(new.message, 160) || '"', new.id);
  return new;
end $$;
drop trigger if exists feedback_notify on public.feedbacks;
create trigger feedback_notify after insert on public.feedbacks for each row execute function public.feedback_notify();

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  description text check (description is null or length(description) <= 4000),
  metric text not null default 'percent' check (metric in ('percent', 'number', 'boolean')),
  unit text check (unit is null or length(unit) <= 20),
  start_value numeric not null default 0,
  target_value numeric not null default 100,
  current_value numeric not null default 0,
  start_date date,
  due_date date,
  status text not null default 'active' check (status in ('active', 'done', 'cancelled')),
  created_by uuid default public.get_current_profile_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goals_owner on public.goals(company_id, profile_id);
alter table public.goals enable row level security;
drop policy if exists "Goals of me or my team" on public.goals;
create policy "Goals of me or my team" on public.goals for all to authenticated
  using (public.same_company(company_id) and (profile_id = public.get_current_profile_id() or public.manages_profile(profile_id)))
  with check (public.same_company(company_id) and (profile_id = public.get_current_profile_id() or public.manages_profile(profile_id))
    and exists (select 1 from public.profiles p where p.id = profile_id and p.company_id = public.current_company_id()));
grant select, insert, update, delete on public.goals to authenticated;

create table if not exists public.goal_updates (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  value numeric not null,
  note text check (note is null or length(note) <= 1000),
  created_by uuid default public.get_current_profile_id(),
  created_at timestamptz not null default now()
);
alter table public.goal_updates enable row level security;
drop policy if exists "Goal updates" on public.goal_updates;
create policy "Goal updates" on public.goal_updates for all to authenticated
  using (exists (select 1 from public.goals g where g.id = goal_id)) with check (exists (select 1 from public.goals g where g.id = goal_id) and created_by = public.get_current_profile_id());
grant select, insert, delete on public.goal_updates to authenticated;

create or replace function public.goal_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.current_value is distinct from old.current_value then
    insert into public.goal_updates(goal_id, value, created_by) values (new.id, new.current_value, public.get_current_profile_id());
  end if;
  return new;
end $$;
/** The person updates progress/status of a goal their manager set, but not what the goal is. */
create or replace function public.goal_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now(); new.company_id := old.company_id; new.created_by := old.created_by; new.created_at := old.created_at;
  if old.created_by is distinct from public.get_current_profile_id() and not public.manages_profile(old.profile_id) then
    new.profile_id := old.profile_id; new.title := old.title; new.description := old.description; new.metric := old.metric; new.unit := old.unit;
    new.start_value := old.start_value; new.target_value := old.target_value; new.start_date := old.start_date; new.due_date := old.due_date;
  end if;
  return new;
end $$;
drop trigger if exists goal_before_update on public.goals;
create trigger goal_before_update before update on public.goals for each row execute function public.goal_before_update();
drop trigger if exists goal_after_update on public.goals;
create trigger goal_after_update after update of current_value on public.goals for each row execute function public.goal_after_update();

create or replace function public.goal_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if new.profile_id is distinct from new.created_by then
    select user_id into u from public.profiles where id = new.profile_id;
    perform public.notify_user(u, 'goal', 'Nova meta', public.profile_name(new.created_by) || ' definiu a meta "' || left(new.title, 120) || '" para você.', new.id);
  end if;
  return new;
end $$;
drop trigger if exists goal_notify on public.goals;
create trigger goal_notify after insert on public.goals for each row execute function public.goal_notify();

create table if not exists public.evaluation_goals (
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  progress numeric,
  created_at timestamptz not null default now(),
  primary key (evaluation_id, goal_id)
);
alter table public.evaluation_goals enable row level security;
drop policy if exists "Evaluation goals" on public.evaluation_goals;
create policy "Evaluation goals" on public.evaluation_goals for all to authenticated
  using (exists (select 1 from public.evaluations e where e.id = evaluation_id) and exists (select 1 from public.goals g where g.id = goal_id))
  with check (exists (select 1 from public.evaluations e where e.id = evaluation_id and e.evaluator_id = public.get_current_profile_id()) and exists (select 1 from public.goals g where g.id = goal_id));
grant select, insert, delete on public.evaluation_goals to authenticated;

alter table public.companies add column if not exists auto_onboarding boolean not null default false;

-- ───────────── E. wiki
create table if not exists public.wiki_pages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  parent_id uuid references public.wiki_pages(id) on delete cascade,
  sector_id uuid references public.sectors(id) on delete set null,
  title text not null check (length(trim(title)) between 1 and 200),
  icon text check (icon is null or length(icon) <= 40),
  content text not null default '' check (length(content) <= 500000),
  position integer not null default 0,
  visibility text not null default 'company' check (visibility in ('company', 'sector')),
  edit_scope text not null default 'all' check (edit_scope in ('admins', 'sector', 'all')),
  created_by uuid default public.get_current_profile_id(),
  updated_by uuid default public.get_current_profile_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('portuguese', coalesce(title, '') || ' ' || regexp_replace(coalesce(content, ''), '<[^>]+>', ' ', 'g'))) stored
);
create index if not exists wiki_pages_company on public.wiki_pages(company_id, sector_id, parent_id, position);
create index if not exists wiki_pages_search on public.wiki_pages using gin(search);
alter table public.wiki_pages enable row level security;

create or replace function public.wiki_can_edit(_scope text, _sector uuid, _creator uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or _creator = public.get_current_profile_id() or _scope = 'all'
    or (_scope = 'sector' and _sector is not null and public.is_sector_member(_sector))
    or (_sector is not null and exists (select 1 from public.sectors s where s.id = _sector and s.manager_id = public.get_current_profile_id()))
$$;
drop policy if exists "Read wiki" on public.wiki_pages;
create policy "Read wiki" on public.wiki_pages for select to authenticated
  using (public.same_company(company_id) and (visibility = 'company' or sector_id is null or public.is_sector_member(sector_id) or public.is_admin() or created_by = public.get_current_profile_id()));
drop policy if exists "Create wiki" on public.wiki_pages;
create policy "Create wiki" on public.wiki_pages for insert to authenticated
  with check (public.same_company(company_id) and created_by = public.get_current_profile_id()
    and (sector_id is null or public.is_sector_member(sector_id) or public.is_admin()));
drop policy if exists "Edit wiki" on public.wiki_pages;
create policy "Edit wiki" on public.wiki_pages for update to authenticated
  using (public.same_company(company_id) and public.wiki_can_edit(edit_scope, sector_id, created_by))
  with check (public.same_company(company_id));
drop policy if exists "Delete wiki" on public.wiki_pages;
create policy "Delete wiki" on public.wiki_pages for delete to authenticated
  using (public.same_company(company_id) and (public.is_admin() or created_by = public.get_current_profile_id()));
grant select, insert, update, delete on public.wiki_pages to authenticated;

create table if not exists public.wiki_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.wiki_pages(id) on delete cascade,
  title text not null,
  content text not null,
  edited_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists wiki_versions_page on public.wiki_page_versions(page_id, created_at desc);
alter table public.wiki_page_versions enable row level security;
drop policy if exists "Read versions" on public.wiki_page_versions;
create policy "Read versions" on public.wiki_page_versions for select to authenticated using (exists (select 1 from public.wiki_pages p where p.id = page_id));
grant select on public.wiki_page_versions to authenticated;

create or replace function public.wiki_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now(); new.updated_by := public.get_current_profile_id();
  new.company_id := old.company_id; new.created_by := old.created_by; new.created_at := old.created_at;
  -- only the author, the sector manager or an admin change who can see/edit the page and where it lives
  if not (public.is_admin() or old.created_by = public.get_current_profile_id()
          or (old.sector_id is not null and exists (select 1 from public.sectors s where s.id = old.sector_id and s.manager_id = public.get_current_profile_id()))) then
    new.edit_scope := old.edit_scope; new.visibility := old.visibility; new.sector_id := old.sector_id;
  end if;
  if new.content is distinct from old.content or new.title is distinct from old.title then
    -- one version per 10 minutes per editor, so autosave does not flood the history
    if not exists (select 1 from public.wiki_page_versions v where v.page_id = old.id and v.edited_by = old.updated_by and v.created_at > now() - interval '10 minutes')
       or old.updated_by is distinct from new.updated_by then
      insert into public.wiki_page_versions(page_id, title, content, edited_by) values (old.id, old.title, old.content, old.updated_by);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists wiki_before_update on public.wiki_pages;
create trigger wiki_before_update before update on public.wiki_pages for each row execute function public.wiki_before_update();

create or replace function public.wiki_search(_q text)
returns table (id uuid, title text, sector_id uuid, snippet text, rank real)
language sql stable security invoker set search_path = public as $$
  select p.id, p.title, p.sector_id,
    ts_headline('portuguese', regexp_replace(p.content, '<[^>]+>', ' ', 'g'), websearch_to_tsquery('portuguese', _q), 'MaxWords=24, MinWords=8, StartSel=«, StopSel=»'),
    ts_rank(p.search, websearch_to_tsquery('portuguese', _q))
  from public.wiki_pages p
  where p.search @@ websearch_to_tsquery('portuguese', _q) or p.title ilike '%' || _q || '%'
  order by 5 desc, p.title limit 30
$$;
grant execute on function public.wiki_search(text) to authenticated;

-- ───────────── realtime + cron
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_pins') then
    alter publication supabase_realtime add table public.chat_pins;
  end if;
end $$;
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'ewvon-scheduled-messages';
  perform cron.schedule('ewvon-scheduled-messages', '* * * * *', 'select public.send_scheduled_messages()');
end $$;
