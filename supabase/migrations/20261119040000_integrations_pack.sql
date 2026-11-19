-- Integrations pack:
--  1. calendar_feeds: personal iCal link (Google Agenda / Outlook / iPhone) served by the `ical` edge function.
--  2. board_inbound_keys: per-mural key so forms, Zapier/Make or the company's own system CREATE cards (edge function
--     `cards-in`). Only the board owner/admin manages keys.
--  3. task_time_entries + task_timer(): time tracking per card (start/stop, one running timer per person).
--  4. Instant automation triggers on task_automation_rules (card_created, moved_to_column, card_completed,
--     card_assigned) and new actions (assign_to, add_label, set_due_days) evaluated at once by a trigger.
--  5. company_webhooks.format: deliver as plain JSON or as a ready message to Discord, Google Chat, Telegram or Slack.

-- 1 ─ iCal feed
create table if not exists public.calendar_feeds (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(20), 'hex'),
  created_at timestamptz not null default now(),
  last_at timestamptz
);
alter table public.calendar_feeds enable row level security;
drop policy if exists "Own calendar feed" on public.calendar_feeds;
create policy "Own calendar feed" on public.calendar_feeds for select to authenticated using (profile_id = public.get_current_profile_id());

create or replace function public.my_calendar_feed(_regen boolean default false)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := public.get_current_profile_id(); t text;
begin
  if me is null then return null; end if;
  if _regen then delete from public.calendar_feeds where profile_id = me; end if;
  insert into public.calendar_feeds(profile_id) values (me) on conflict (profile_id) do nothing;
  select token into t from public.calendar_feeds where profile_id = me;
  return t;
end $$;
revoke all on function public.my_calendar_feed(boolean) from public, anon;
grant execute on function public.my_calendar_feed(boolean) to authenticated;

-- 2 ─ inbound keys (create cards from outside)
create table if not exists public.board_inbound_keys (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.task_boards(id) on delete cascade,
  column_id uuid references public.task_board_columns(id) on delete set null,
  token text not null unique default 'ewv_' || encode(extensions.gen_random_bytes(24), 'hex'),
  description text,
  enabled boolean not null default true,
  created_by uuid default public.get_current_profile_id() references public.profiles(id) on delete set null,
  last_at timestamptz,
  uses integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists board_inbound_keys_board on public.board_inbound_keys(board_id);
alter table public.board_inbound_keys enable row level security;
drop policy if exists "Board admins manage inbound keys" on public.board_inbound_keys;
create policy "Board admins manage inbound keys" on public.board_inbound_keys for all to authenticated
  using (public.is_board_admin_or_owner(board_id)) with check (public.is_board_admin_or_owner(board_id));

-- 3 ─ time tracking
create table if not exists public.task_time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  company_id uuid not null default public.current_company_id() references public.companies(id) on delete cascade,
  profile_id uuid not null default public.get_current_profile_id() references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index if not exists task_time_entries_task on public.task_time_entries(task_id);
create unique index if not exists task_time_entries_running on public.task_time_entries(profile_id) where ended_at is null;
alter table public.task_time_entries enable row level security;
drop policy if exists "See time of visible cards" on public.task_time_entries;
create policy "See time of visible cards" on public.task_time_entries for select to authenticated
  using (company_id = public.current_company_id() and exists (select 1 from public.tasks t where t.id = task_id));
drop policy if exists "Write own time" on public.task_time_entries;
create policy "Write own time" on public.task_time_entries for insert to authenticated
  with check (profile_id = public.get_current_profile_id() and company_id = public.current_company_id() and exists (select 1 from public.tasks t where t.id = task_id));
drop policy if exists "Edit own time" on public.task_time_entries;
create policy "Edit own time" on public.task_time_entries for update to authenticated
  using (profile_id = public.get_current_profile_id()) with check (profile_id = public.get_current_profile_id());
drop policy if exists "Delete own time" on public.task_time_entries;
create policy "Delete own time" on public.task_time_entries for delete to authenticated using (profile_id = public.get_current_profile_id());

-- start: stops my running timer (any card) and opens a new one; stop: closes my running timer on this card
create or replace function public.task_timer(_task uuid, _action text)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare me uuid := public.get_current_profile_id(); r public.task_time_entries;
begin
  if me is null then raise exception 'NOT_LOGGED'; end if;
  update public.task_time_entries set ended_at = now() where profile_id = me and ended_at is null;
  if _action = 'start' then
    insert into public.task_time_entries(task_id) values (_task) returning * into r;
    return to_jsonb(r);
  end if;
  return null;
end $$;
revoke all on function public.task_timer(uuid, text) from public, anon;
grant execute on function public.task_timer(uuid, text) to authenticated;

-- 4 ─ instant automation rules
create or replace function public.tasks_instant_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; fire boolean; uid uuid; col record; d integer;
begin
  if pg_trigger_depth() > 1 or coalesce(new.is_template, false) or new.board_id is null then return new; end if;
  for r in select * from public.task_automation_rules a
           where a.is_active and a.board_id = new.board_id and (a.task_id is null or a.task_id = new.id)
             and a.trigger_type in ('card_created', 'moved_to_column', 'card_completed', 'card_assigned') loop
    fire := case r.trigger_type
      when 'card_created' then tg_op = 'INSERT'
      when 'moved_to_column' then (tg_op = 'INSERT' or new.status is distinct from old.status) and new.status = r.trigger_config->>'column_id'
      when 'card_completed' then new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null)
      when 'card_assigned' then new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
      else false end;
    if not fire then continue; end if;
    begin
      if r.action_type = 'move_column' and r.action_config ? 'column_id' and new.status is distinct from r.action_config->>'column_id' then
        select * into col from public.task_board_columns where id::text = r.action_config->>'column_id' and board_id = new.board_id;
        if col.id is not null then
          update public.tasks set status = col.id::text, position = 0,
            completed_at = case when col.is_conclusion then coalesce(completed_at, now()) else completed_at end,
            completed_late = case when col.is_conclusion and completed_at is null then (due_date is not null and now() > due_date) else completed_late end
          where id = new.id;
        end if;
      elsif r.action_type = 'set_priority' and r.action_config ? 'priority' then
        update public.tasks set priority = r.action_config->>'priority' where id = new.id and priority is distinct from r.action_config->>'priority';
      elsif r.action_type = 'assign_to' and r.action_config ? 'profile_id' then
        update public.tasks set assigned_to = (r.action_config->>'profile_id')::uuid where id = new.id
          and assigned_to is distinct from (r.action_config->>'profile_id')::uuid
          and exists (select 1 from public.profiles p where p.id = (r.action_config->>'profile_id')::uuid and p.company_id = new.company_id and p.is_active);
      elsif r.action_type = 'add_label' and r.action_config ? 'label_id' then
        insert into public.task_label_assignments(task_id, label_id)
          select new.id, l.id from public.task_labels l where l.id = (r.action_config->>'label_id')::uuid and l.board_id = new.board_id
            and not exists (select 1 from public.task_label_assignments x where x.task_id = new.id and x.label_id = l.id);
      elsif r.action_type = 'set_due_days' then
        d := greatest(0, least(365, coalesce((r.action_config->>'days')::int, 1)));
        update public.tasks set due_date = (date_trunc('day', now() at time zone 'America/Sao_Paulo') + make_interval(days => d) + interval '18 hours') at time zone 'America/Sao_Paulo' where id = new.id;
      elsif r.action_type = 'notify' then
        select p.user_id into uid from public.profiles p where p.id = coalesce((r.action_config->>'profile_id')::uuid, new.assigned_to);
        if uid is not null then
          insert into public.user_notifications(user_id, type, title, message, reference_id)
          values (uid, 'automation', 'Automação do mural', 'Card #' || coalesce(new.task_number::text, '?') || ' "' || left(new.title, 120) || '"' ||
            case r.trigger_type when 'card_created' then ' foi criado' when 'moved_to_column' then ' entrou na coluna configurada' when 'card_completed' then ' foi concluído' else ' recebeu um responsável' end, new.id);
        end if;
      elsif r.action_type = 'alert' and new.assigned_to is not null then
        insert into public.workload_alerts(profile_id, board_id, alert_type, message, task_id)
        values (new.assigned_to, new.board_id, 'late_task', 'Card #' || coalesce(new.task_number::text, '?') || ' "' || left(new.title, 120) || '" requer atenção', new.id);
      end if;
    exception when others then null;   -- a broken rule never blocks the card change
    end;
  end loop;
  return new;
end $$;
drop trigger if exists tasks_instant_rules on public.tasks;
create trigger tasks_instant_rules after insert or update of status, completed_at, assigned_to on public.tasks
  for each row execute function public.tasks_instant_rules();

-- 5 ─ webhook delivery format
alter table public.company_webhooks add column if not exists format text not null default 'json';
alter table public.company_webhooks drop constraint if exists company_webhooks_format_check;
alter table public.company_webhooks add constraint company_webhooks_format_check check (format in ('json', 'discord', 'gchat', 'telegram', 'slack'));

-- one line of Portuguese text for chat-style destinations
create or replace function public.ewvon_event_text(_event text, _data jsonb)
returns text language plpgsql immutable as $$
declare t jsonb := _data->'task'; card text; msg text;
begin
  card := case when t is null then '' else '#' || coalesce(t->>'number', '?') || ' "' || coalesce(t->>'title', '') || '"' ||
    case when t->'board'->>'name' is not null then ' (' || (t->'board'->>'name') || ')' else '' end end;
  msg := case _event
    when 'task.created' then '🆕 Card criado: ' || card
    when 'task.moved' then '➡️ Card ' || card || ' foi para "' || coalesce(t->'column'->>'title', '?') || '"'
    when 'task.completed' then '✅ Card concluído: ' || card
    when 'task.assigned' then '👤 ' || coalesce(t->'assignee'->>'name', 'Alguém') || ' é o responsável por ' || card
    when 'task.due_changed' then '📅 Prazo alterado: ' || card || coalesce(' → ' || to_char((t->>'due_date')::timestamptz at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), ' → sem prazo')
    when 'task.deleted' then '🗑️ Card excluído: ' || card
    when 'comment.created' then '💬 ' || coalesce(_data->'comment'->'author'->>'name', 'Alguém') || ' comentou em ' || card || ': ' || left(coalesce(_data->'comment'->>'text', ''), 300)
    when 'announcement.published' then '📢 Novo aviso: ' || coalesce(_data->'announcement'->>'title', '')
    when 'meeting.booked' then '🗓️ Reunião agendada: ' || coalesce(_data->'meeting'->>'title', '') || ' — ' || coalesce(_data->'meeting'->>'room', '') || ' às ' || coalesce(to_char((_data->'meeting'->>'starts_at')::timestamptz at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), '?')
    when 'meeting.cancelled' then '❌ Reunião cancelada: ' || coalesce(_data->'meeting'->>'title', '')
    when 'war_room.opened' then '🚨 War Room aberta: ' || coalesce(_data->'war_room'->>'title', '')
    when 'war_room.closed' then '🏁 War Room encerrada: ' || coalesce(_data->'war_room'->>'title', '')
    when 'employee.created' then '🎉 Novo colaborador cadastrado: ' || coalesce(_data->'employee'->>'name', '') || coalesce(' (' || (_data->'employee'->>'sector') || ')', '')
    when 'employee.deactivated' then '🚪 Colaborador desativado: ' || coalesce(_data->'employee'->>'name', '')
    when 'employee.reactivated' then '↩️ Colaborador reativado: ' || coalesce(_data->'employee'->>'name', '')
    when 'test' then '🔔 Teste do ewvon: a integração está funcionando.'
    else _event end;
  if t ? 'url' and _event <> 'task.deleted' then msg := msg || E'\n' || (t->>'url'); end if;
  return msg;
end $$;

create or replace function public.ewvon_webhook_post(_hook public.company_webhooks, _event text, _data jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare body text; txt text;
begin
  if coalesce(_hook.format, 'json') = 'json' then
    body := jsonb_build_object('event', _event, 'sent_at', now(), 'company_id', _hook.company_id, 'data', _data)::text;
  else
    txt := public.ewvon_event_text(_event, _data);
    body := case _hook.format
      when 'discord' then jsonb_build_object('content', left(txt, 1900), 'username', 'ewvon')
      when 'telegram' then jsonb_build_object('text', left(txt, 4000), 'disable_web_page_preview', true,
        'chat_id', substring(_hook.url from '[?&]chat_id=([^&]+)'))
      else jsonb_build_object('text', left(txt, 4000)) end::text;      -- gchat, slack
  end if;
  perform net.http_post(
    url := _hook.url, body := body::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'User-Agent', 'ewvon-webhooks/1', 'X-Ewvon-Event', _event,
      'X-Ewvon-Signature', 'sha256=' || encode(extensions.hmac(body, _hook.secret, 'sha256'), 'hex')),
    timeout_milliseconds := 8000);
  update public.company_webhooks set last_at = now() where id = _hook.id;
end $$;
revoke all on function public.ewvon_webhook_post(public.company_webhooks, text, jsonb) from public, anon, authenticated;
