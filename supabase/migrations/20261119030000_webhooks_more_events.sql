-- More webhook events: card assigned / due date changed / deleted, comment added, notice published, meeting booked,
-- War Room opened / closed, collaborator added / deactivated / reactivated. One helper sends to every enabled hook of the company that
-- subscribed to the event; failures never block the original change.
create or replace function public.ewvon_webhook_fire(_company uuid, _event text, _data jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare h public.company_webhooks;
begin
  if _company is null then return; end if;
  for h in select * from public.company_webhooks w where w.company_id = _company and w.enabled and _event = any(w.events) loop
    begin perform public.ewvon_webhook_post(h, _event, _data); exception when others then null; end;
  end loop;
end $$;
revoke all on function public.ewvon_webhook_fire(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.ewvon_task_json(t public.tasks)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'number', t.task_number, 'title', t.title, 'priority', t.priority, 'due_date', t.due_date,
    'completed_at', t.completed_at, 'board', jsonb_build_object('id', b.id, 'name', b.name), 'column', jsonb_build_object('id', c.id, 'title', c.title),
    'assignee', case when p.id is null then null else jsonb_build_object('id', p.id, 'name', coalesce(p.display_name, p.name)) end,
    'url', 'https://ewvon.com/tarefas?board=' || t.board_id || '&task=' || t.id)
  from (select 1) x left join public.task_boards b on b.id = t.board_id left join public.task_board_columns c on c.id::text = t.status left join public.profiles p on p.id = t.assigned_to;
$$;

-- tasks: extra events on update/delete (created/moved/completed stay in tasks_webhook_trigger)
create or replace function public.tasks_webhook_extra()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'DELETE' then
    if not coalesce(old.is_template, false) then perform public.ewvon_webhook_fire(old.company_id, 'task.deleted', jsonb_build_object('task', jsonb_build_object('id', old.id, 'number', old.task_number, 'title', old.title, 'board_id', old.board_id))); end if;
    return old;
  end if;
  if coalesce(new.is_template, false) then return new; end if;
  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then perform public.ewvon_webhook_fire(new.company_id, 'task.assigned', jsonb_build_object('task', public.ewvon_task_json(new))); end if;
  if new.due_date is distinct from old.due_date then perform public.ewvon_webhook_fire(new.company_id, 'task.due_changed', jsonb_build_object('task', public.ewvon_task_json(new), 'previous_due_date', old.due_date)); end if;
  return new;
end $$;
drop trigger if exists tasks_webhook_extra on public.tasks;
create trigger tasks_webhook_extra after update of assigned_to, due_date or delete on public.tasks for each row execute function public.tasks_webhook_extra();

create or replace function public.comments_webhook()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare t public.tasks; a record;
begin
  select * into t from public.tasks where id = new.task_id; if t.id is null then return new; end if;
  select id, coalesce(display_name, name) as name into a from public.profiles where id = new.author_id;
  perform public.ewvon_webhook_fire(t.company_id, 'comment.created', jsonb_build_object('comment', jsonb_build_object('id', new.id, 'text', left(new.content, 2000), 'created_at', new.created_at, 'author', jsonb_build_object('id', a.id, 'name', a.name)), 'task', public.ewvon_task_json(t)));
  return new;
end $$;
drop trigger if exists comments_webhook on public.task_comments;
create trigger comments_webhook after insert on public.task_comments for each row execute function public.comments_webhook();

create or replace function public.announcements_webhook()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.ewvon_webhook_fire(new.company_id, 'announcement.published', jsonb_build_object('announcement', jsonb_build_object('id', new.id, 'title', new.title, 'content', left(new.content, 4000), 'priority', new.priority, 'pinned', new.is_pinned, 'start_at', new.start_at, 'expire_at', new.expire_at)));
  return new;
end $$;
drop trigger if exists announcements_webhook on public.announcements;
create trigger announcements_webhook after insert on public.announcements for each row execute function public.announcements_webhook();

create or replace function public.bookings_webhook()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare r record; p record;
begin
  select name into r from public.meeting_rooms where id = new.room_id;
  select coalesce(display_name, name) as name into p from public.profiles where id = new.booked_by or user_id = new.booked_by limit 1;
  perform public.ewvon_webhook_fire(new.company_id, 'meeting.booked',
    jsonb_build_object('meeting', jsonb_build_object('id', new.id, 'title', new.title, 'room', r.name, 'starts_at', new.starts_at, 'ends_at', new.ends_at, 'booked_by', p.name)));
  return new;
end $$;
create or replace function public.bookings_webhook_del()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  select name into r from public.meeting_rooms where id = old.room_id;
  perform public.ewvon_webhook_fire(old.company_id, 'meeting.cancelled', jsonb_build_object('meeting', jsonb_build_object('id', old.id, 'title', old.title, 'room', r.name, 'starts_at', old.starts_at, 'ends_at', old.ends_at)));
  return old;
end $$;
drop trigger if exists bookings_webhook on public.meeting_bookings;
create trigger bookings_webhook after insert on public.meeting_bookings for each row execute function public.bookings_webhook();
drop trigger if exists bookings_webhook_del on public.meeting_bookings;
create trigger bookings_webhook_del after delete on public.meeting_bookings for each row execute function public.bookings_webhook_del();

create or replace function public.war_rooms_webhook()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare ev text;
begin
  if tg_op = 'INSERT' then ev := 'war_room.opened';
  elsif new.status is distinct from old.status and new.closed_at is not null then ev := 'war_room.closed';
  else return new; end if;
  perform public.ewvon_webhook_fire(new.company_id, ev, jsonb_build_object('war_room', jsonb_build_object('id', new.id, 'title', new.title, 'description', left(new.description, 2000), 'status', new.status, 'target_at', new.target_at, 'created_at', new.created_at, 'closed_at', new.closed_at)));
  return new;
end $$;
drop trigger if exists war_rooms_webhook on public.war_rooms;
create trigger war_rooms_webhook after insert or update of status, closed_at on public.war_rooms for each row execute function public.war_rooms_webhook();

create or replace function public.profiles_webhook()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare ev text; s record;
begin
  if coalesce(new.profile_type, 'user') in ('system', 'bot') or new.company_id is null then return new; end if;
  if tg_op = 'INSERT' and new.is_active then ev := 'employee.created';
  elsif tg_op = 'UPDATE' and old.company_id is null and new.company_id is not null and new.is_active then ev := 'employee.created';
  elsif tg_op = 'UPDATE' and old.is_active and not new.is_active then ev := 'employee.deactivated';
  elsif tg_op = 'UPDATE' and not old.is_active and new.is_active then ev := 'employee.reactivated';
  else return new; end if;
  select name into s from public.sectors where id = new.sector_id;
  perform public.ewvon_webhook_fire(new.company_id, ev, jsonb_build_object('employee', jsonb_build_object('id', new.id, 'name', coalesce(new.display_name, new.name), 'email', new.email, 'sector', s.name, 'active', new.is_active)));
  return new;
end $$;
drop trigger if exists profiles_webhook on public.profiles;
create trigger profiles_webhook after insert or update of is_active, company_id on public.profiles for each row execute function public.profiles_webhook();
