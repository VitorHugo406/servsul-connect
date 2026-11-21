-- Competitive pack 3 (one migration so it needs one approval):
--  A. Who did what on a card (Relatórios › Movimentações por pessoa): checklist_add/done/undone, assign, due, priority.
--  B. Lixeira de cards: every deleted card (not templates, not when its mural is being deleted) is kept 30 days in
--     task_trash with its checklists, comments, labels, people, fields, links, time, decisions, repetition and
--     dependencies; restore_trashed_task() puts it back with the same id and number; purge after 30 days.
--  C. Aprovação no card: task_approvals (pending → approved/rejected/cancelled), the approver is notified and decides
--     with task_approval_decide(), which can move the card to a chosen column.
--  D. Lembretes de prazo: task_due_reminders() (cron every 5 min) notifies the responsible + co-responsible people
--     reminder_minutes before the due date (card "Lembrete") and once when the card becomes late.
-- Notifications go to user_notifications (bell of the PC top bar and the assistant).

-- ───────────── A. activity log
create or replace function public.task_log_auto(_task uuid, _type text, _desc text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nm text;
begin
  if uid is null or current_setting('ewvon.restoring', true) = 'on' then return; end if;
  if exists (select 1 from public.tasks t where t.id = _task and coalesce(t.is_template, false)) then return; end if;
  select coalesce(nullif(p.display_name, ''), p.name, 'Usuário') into nm from public.profiles p where p.user_id = uid order by p.is_active desc limit 1;
  insert into public.task_activities(task_id, user_id, user_name, action_type, description, metadata)
  values (_task, uid, coalesce(nm, 'Usuário'), _type, left(_desc, 500), '{}'::jsonb);
exception when others then null;
end $$;
revoke all on function public.task_log_auto(uuid, text, text) from public, anon, authenticated;

create or replace function public.task_subtasks_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.task_log_auto(new.task_id, 'checklist_add', 'Adicionou o item "' || left(new.title, 200) || '"');
  elsif new.is_completed is distinct from old.is_completed then
    perform public.task_log_auto(new.task_id, case when new.is_completed then 'checklist_done' else 'checklist_undone' end,
      case when new.is_completed then 'Concluiu o item "' else 'Reabriu o item "' end || left(new.title, 200) || '"');
  end if;
  return new;
end $$;
drop trigger if exists task_subtasks_log on public.task_subtasks;
create trigger task_subtasks_log after insert or update of is_completed on public.task_subtasks
  for each row execute function public.task_subtasks_log();

create or replace function public.tasks_edit_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then return new; end if;
  if new.assigned_to is distinct from old.assigned_to then perform public.task_log_auto(new.id, 'assign', 'Alterou o responsável'); end if;
  if new.due_date is distinct from old.due_date then perform public.task_log_auto(new.id, 'due', 'Alterou o prazo'); end if;
  if new.priority is distinct from old.priority then perform public.task_log_auto(new.id, 'priority', 'Alterou a prioridade para ' || coalesce(new.priority, '—')); end if;
  return new;
end $$;
drop trigger if exists tasks_edit_log on public.tasks;
create trigger tasks_edit_log after update of assigned_to, due_date, priority on public.tasks
  for each row execute function public.tasks_edit_log();

-- restoring a card keeps its number and never fires the mural's instant rules
do $$ declare d text; begin
  d := pg_get_functiondef('public.tasks_number_per_board'::regproc);
  if position('ewvon.restoring' in d) = 0 then
    d := replace(d, 'IF NEW.board_id IS NULL THEN RETURN NEW; END IF;',
      'IF NEW.board_id IS NULL THEN RETURN NEW; END IF;
  IF current_setting(''ewvon.restoring'', true) = ''on'' AND NEW.task_number IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.tasks x WHERE x.board_id = NEW.board_id AND x.task_number = NEW.task_number AND x.id <> NEW.id) THEN RETURN NEW; END IF;');
    execute d;
  end if;
  d := pg_get_functiondef('public.tasks_instant_rules'::regproc);
  if position('ewvon.restoring' in d) = 0 then
    d := replace(d, 'if pg_trigger_depth() > 1 or', 'if pg_trigger_depth() > 1 or current_setting(''ewvon.restoring'', true) = ''on'' or');
    execute d;
  end if;
end $$;

-- ───────────── B. lixeira
create table if not exists public.task_trash (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  board_id uuid not null,
  company_id uuid references public.companies(id) on delete cascade,
  task_number integer,
  title text not null default '',
  deleted_by uuid,                                   -- profile id
  deleted_by_name text,
  deleted_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists task_trash_board on public.task_trash(board_id, deleted_at desc);
create index if not exists task_trash_deleted on public.task_trash(deleted_at);
alter table public.task_trash enable row level security;
drop policy if exists "Members see the mural trash" on public.task_trash;
create policy "Members see the mural trash" on public.task_trash for select to authenticated
  using (public.is_board_member(board_id) and public.same_company(company_id));
revoke insert, update, delete on public.task_trash from anon, authenticated;
grant select on public.task_trash to authenticated;

create or replace function public.task_trash_capture()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid; nm text;
begin
  if coalesce(old.is_template, false) or old.board_id is null then return old; end if;
  if not exists (select 1 from public.task_boards b where b.id = old.board_id) then return old; end if;  -- whole mural deleted
  select p.id, coalesce(nullif(p.display_name, ''), p.name) into pid, nm from public.profiles p where p.user_id = auth.uid() order by p.is_active desc limit 1;
  insert into public.task_trash(task_id, board_id, company_id, task_number, title, deleted_by, deleted_by_name, data)
  values (old.id, old.board_id, old.company_id, old.task_number, coalesce(old.title, ''), pid, nm, jsonb_build_object(
    'task', to_jsonb(old),
    'subtask_groups', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.subtask_groups x where x.task_id = old.id),
    'task_subtasks', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.task_subtasks x where x.task_id = old.id),
    'task_comments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.task_comments x where x.task_id = old.id),
    'task_label_assignments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.task_label_assignments x where x.task_id = old.id),
    'task_assignees', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.task_assignees x where x.task_id = old.id),
    'task_activities', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.task_activities x where x.task_id = old.id),
    'task_decisions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.task_decisions x where x.task_id = old.id),
    'task_covers', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.task_covers x where x.task_id = old.id),
    'task_time_entries', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.task_time_entries x where x.task_id = old.id),
    'task_field_values', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.task_field_values x where x.task_id = old.id),
    'task_dependencies', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.task_dependencies x where x.task_id = old.id or x.depends_on = old.id),
    'task_links', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.task_links x where x.task_id = old.id),
    'task_auto_duplications', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.task_auto_duplications x where x.task_id = old.id),
    'guest_comments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.guest_comments x where x.task_id = old.id)));
  return old;
exception when others then
  return old;  -- the trash must never block a deletion
end $$;
drop trigger if exists task_trash_capture on public.tasks;
create trigger task_trash_capture before delete on public.tasks for each row execute function public.task_trash_capture();

create or replace function public.restore_trashed_task(_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.task_trash; st text; d jsonb; k text;
begin
  select * into r from public.task_trash where id = _id;
  if r.id is null then raise exception 'TRASH_NOT_FOUND:'; end if;
  if not (public.is_board_member(r.board_id) and public.same_company(r.company_id)) then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.task_boards b where b.id = r.board_id) then raise exception 'TRASH_NO_BOARD:'; end if;
  if exists (select 1 from public.tasks where id = r.task_id) then delete from public.task_trash where id = _id; return r.task_id; end if;
  d := r.data;
  st := d->'task'->>'status';
  if not exists (select 1 from public.task_board_columns c where c.board_id = r.board_id and c.id::text = st) then
    select c.id::text into st from public.task_board_columns c where c.board_id = r.board_id order by c.position limit 1;
  end if;
  perform set_config('ewvon.restoring', 'on', true);
  insert into public.tasks select * from jsonb_populate_record(null::public.tasks, (d->'task') || jsonb_build_object('status', st, 'updated_at', now()));
  begin insert into public.subtask_groups select * from jsonb_populate_recordset(null::public.subtask_groups, d->'subtask_groups'); exception when others then null; end;
  begin insert into public.task_subtasks select x.* from jsonb_populate_recordset(null::public.task_subtasks, d->'task_subtasks') x
        where x.group_id is null or exists (select 1 from public.subtask_groups g where g.id = x.group_id); exception when others then null; end;
  begin insert into public.task_comments select x.* from jsonb_populate_recordset(null::public.task_comments, d->'task_comments') x
        where x.author_id is null or exists (select 1 from public.profiles p where p.id = x.author_id); exception when others then null; end;
  begin insert into public.task_label_assignments select x.* from jsonb_populate_recordset(null::public.task_label_assignments, d->'task_label_assignments') x
        where exists (select 1 from public.task_labels l where l.id = x.label_id); exception when others then null; end;
  begin insert into public.task_assignees select x.* from jsonb_populate_recordset(null::public.task_assignees, d->'task_assignees') x
        where exists (select 1 from public.profiles p where p.id = x.profile_id); exception when others then null; end;
  begin insert into public.task_activities select * from jsonb_populate_recordset(null::public.task_activities, d->'task_activities'); exception when others then null; end;
  begin insert into public.task_decisions select * from jsonb_populate_recordset(null::public.task_decisions, d->'task_decisions'); exception when others then null; end;
  begin insert into public.task_covers select * from jsonb_populate_recordset(null::public.task_covers, d->'task_covers'); exception when others then null; end;
  begin insert into public.task_time_entries select * from jsonb_populate_recordset(null::public.task_time_entries, d->'task_time_entries'); exception when others then null; end;
  begin insert into public.task_field_values select x.* from jsonb_populate_recordset(null::public.task_field_values, d->'task_field_values') x
        where exists (select 1 from public.board_custom_fields f where f.id = x.field_id); exception when others then null; end;
  begin insert into public.task_dependencies select x.* from jsonb_populate_recordset(null::public.task_dependencies, d->'task_dependencies') x
        where exists (select 1 from public.tasks a where a.id = x.task_id) and exists (select 1 from public.tasks b where b.id = x.depends_on); exception when others then null; end;
  begin insert into public.task_links select * from jsonb_populate_recordset(null::public.task_links, d->'task_links'); exception when others then null; end;
  begin insert into public.task_auto_duplications select * from jsonb_populate_recordset(null::public.task_auto_duplications, d->'task_auto_duplications'); exception when others then null; end;
  begin insert into public.guest_comments select * from jsonb_populate_recordset(null::public.guest_comments, d->'guest_comments'); exception when others then null; end;
  perform set_config('ewvon.restoring', 'off', true);
  perform public.task_log_auto(r.task_id, 'restore', 'Restaurou o card da lixeira');
  delete from public.task_trash where id = _id;
  return r.task_id;
end $$;
revoke all on function public.restore_trashed_task(uuid) from public, anon;
grant execute on function public.restore_trashed_task(uuid) to authenticated;

create or replace function public.purge_trashed_task(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.task_trash;
begin
  select * into r from public.task_trash where id = _id;
  if r.id is null then return; end if;
  if not (public.same_company(r.company_id) and (public.is_board_admin_or_owner(r.board_id) or public.is_admin()
          or r.deleted_by = public.get_current_profile_id())) then raise exception 'not allowed'; end if;
  delete from public.task_trash where id = _id;
end $$;
revoke all on function public.purge_trashed_task(uuid) from public, anon;
grant execute on function public.purge_trashed_task(uuid) to authenticated;

-- ───────────── C. aprovação
create table if not exists public.task_approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  board_id uuid,
  requested_by uuid not null default public.get_current_profile_id() references public.profiles(id) on delete cascade,
  approver_id uuid not null references public.profiles(id) on delete cascade,
  message text check (message is null or length(message) <= 1000),
  on_approve_column uuid references public.task_board_columns(id) on delete set null,
  on_reject_column uuid references public.task_board_columns(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decision_note text check (decision_note is null or length(decision_note) <= 1000),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists task_approvals_task on public.task_approvals(task_id, created_at desc);
create index if not exists task_approvals_approver on public.task_approvals(approver_id, status);
alter table public.task_approvals enable row level security;
drop policy if exists "Members see approvals" on public.task_approvals;
create policy "Members see approvals" on public.task_approvals for select to authenticated
  using (public.is_board_member(board_id) or approver_id = public.get_current_profile_id());
drop policy if exists "Members request approvals" on public.task_approvals;
create policy "Members request approvals" on public.task_approvals for insert to authenticated
  with check (requested_by = public.get_current_profile_id() and status = 'pending'
    and exists (select 1 from public.tasks t where t.id = task_id and t.board_id is not null and public.is_board_member(t.board_id) and public.same_company(t.company_id)));
grant select, insert on public.task_approvals to authenticated;

create or replace function public.task_approvals_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select id, board_id, company_id into t from public.tasks where id = new.task_id;
  new.board_id := t.board_id;
  if not exists (select 1 from public.profiles p where p.id = new.approver_id and p.company_id = t.company_id and p.is_active) then
    raise exception 'APPROVER_INVALID:';
  end if;
  if new.on_approve_column is not null and not exists (select 1 from public.task_board_columns c where c.id = new.on_approve_column and c.board_id = t.board_id) then new.on_approve_column := null; end if;
  if new.on_reject_column is not null and not exists (select 1 from public.task_board_columns c where c.id = new.on_reject_column and c.board_id = t.board_id) then new.on_reject_column := null; end if;
  if exists (select 1 from public.task_approvals a where a.task_id = new.task_id and a.status = 'pending') then raise exception 'APPROVAL_PENDING:'; end if;
  return new;
end $$;
drop trigger if exists task_approvals_before on public.task_approvals;
create trigger task_approvals_before before insert on public.task_approvals for each row execute function public.task_approvals_before();

create or replace function public.task_approvals_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid; who text; t record;
begin
  select user_id into uid from public.profiles where id = new.approver_id;
  select coalesce(nullif(display_name, ''), name) into who from public.profiles where id = new.requested_by;
  select task_number, title into t from public.tasks where id = new.task_id;
  if uid is not null then
    insert into public.user_notifications(user_id, type, title, message, reference_id)
    values (uid, 'approval', 'Aprovação pedida', coalesce(who, 'Alguém') || ' pediu sua aprovação no card #' || coalesce(t.task_number::text, '?') || ' "' || left(t.title, 120) || '"', new.task_id);
  end if;
  perform public.task_log_auto(new.task_id, 'approval_request', 'Pediu aprovação');
  return new;
end $$;
drop trigger if exists task_approvals_after on public.task_approvals;
create trigger task_approvals_after after insert on public.task_approvals for each row execute function public.task_approvals_after();

create or replace function public.task_approval_decide(_id uuid, _approve boolean, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.task_approvals; me uuid := public.get_current_profile_id(); col record; uid uuid; t record; who text;
begin
  select * into a from public.task_approvals where id = _id for update;
  if a.id is null or a.status <> 'pending' then raise exception 'APPROVAL_CLOSED:'; end if;
  if a.approver_id is distinct from me then raise exception 'APPROVAL_NOT_YOURS:'; end if;
  update public.task_approvals set status = case when _approve then 'approved' else 'rejected' end,
    decision_note = nullif(left(coalesce(_note, ''), 1000), ''), decided_at = now() where id = _id;
  select * into col from public.task_board_columns where id = case when _approve then a.on_approve_column else a.on_reject_column end;
  if col.id is not null then
    update public.tasks set status = col.id::text, position = 0,
      completed_at = case when col.is_conclusion then coalesce(completed_at, now()) else null end,
      completed_late = case when col.is_conclusion and completed_at is null then (due_date is not null and now() > due_date) else completed_late end
    where id = a.task_id and status is distinct from col.id::text;
  end if;
  select task_number, title into t from public.tasks where id = a.task_id;
  select user_id into uid from public.profiles where id = a.requested_by;
  select coalesce(nullif(display_name, ''), name) into who from public.profiles where id = me;
  if uid is not null then
    insert into public.user_notifications(user_id, type, title, message, reference_id)
    values (uid, 'approval', case when _approve then 'Aprovado' else 'Recusado' end,
      coalesce(who, 'O aprovador') || case when _approve then ' aprovou' else ' recusou' end || ' o card #' || coalesce(t.task_number::text, '?') || ' "' || left(t.title, 120) || '"'
      || coalesce(': ' || nullif(left(_note, 200), ''), ''), a.task_id);
  end if;
  perform public.task_log_auto(a.task_id, case when _approve then 'approval_ok' else 'approval_no' end, case when _approve then 'Aprovou' else 'Recusou' end || coalesce(': ' || nullif(left(_note, 300), ''), ''));
end $$;
revoke all on function public.task_approval_decide(uuid, boolean, text) from public, anon;
grant execute on function public.task_approval_decide(uuid, boolean, text) to authenticated;

create or replace function public.task_approval_cancel(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.task_approvals;
begin
  select * into a from public.task_approvals where id = _id;
  if a.id is null or a.status <> 'pending' then return; end if;
  if not (a.requested_by = public.get_current_profile_id() or public.is_board_admin_or_owner(a.board_id)) then raise exception 'not allowed'; end if;
  update public.task_approvals set status = 'cancelled', decided_at = now() where id = _id;
end $$;
revoke all on function public.task_approval_cancel(uuid) from public, anon;
grant execute on function public.task_approval_cancel(uuid) to authenticated;

-- ───────────── D. lembretes de prazo
create table if not exists public.task_reminder_log (
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null,
  kind text not null,
  due_date timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (task_id, profile_id, kind, due_date)
);
alter table public.task_reminder_log enable row level security;  -- server only, no policies

create or replace function public.task_due_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; uid uuid;
begin
  for r in
    with due as (
      select t.id, t.task_number, t.title, t.due_date, t.reminder_minutes, t.assigned_to,
        case when t.due_date < now() then 'late' else 'soon' end as kind
      from public.tasks t
      where t.completed_at is null and not coalesce(t.is_template, false) and not coalesce(t.is_archived, false)
        and t.board_id is not null and t.due_date is not null
        and ((t.reminder_minutes is not null and t.reminder_minutes > 0 and now() >= t.due_date - make_interval(mins => t.reminder_minutes) and now() < t.due_date)
          or (t.due_date < now() and t.due_date > now() - interval '2 days'))
        and not exists (select 1 from public.task_board_columns c where c.id::text = t.status and c.is_conclusion)
    ), people as (
      select d.*, d.assigned_to as pid from due d where d.assigned_to is not null
      union
      select d.*, a.profile_id from due d join public.task_assignees a on a.task_id = d.id
    )
    select * from people
  loop
    insert into public.task_reminder_log(task_id, profile_id, kind, due_date) values (r.id, r.pid, r.kind, r.due_date)
      on conflict do nothing;
    if not found then continue; end if;
    select user_id into uid from public.profiles where id = r.pid and is_active;
    if uid is null then continue; end if;
    insert into public.user_notifications(user_id, type, title, message, reference_id)
    values (uid, 'task_reminder', case when r.kind = 'late' then 'Card atrasado' else 'Prazo chegando' end,
      'Card #' || coalesce(r.task_number::text, '?') || ' "' || left(r.title, 120) || '" ' ||
      case when r.kind = 'late' then 'passou do prazo (' else 'vence às ' end ||
      to_char(r.due_date at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || case when r.kind = 'late' then ')' else '' end, r.id);
    n := n + 1;
  end loop;
  delete from public.task_reminder_log where sent_at < now() - interval '60 days';
  return n;
end $$;
revoke all on function public.task_due_reminders() from public, anon, authenticated;

-- ───────────── cron
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('ewvon-task-reminders', 'ewvon-trash-purge');
  perform cron.schedule('ewvon-task-reminders', '*/5 * * * *', 'select public.task_due_reminders()');
  perform cron.schedule('ewvon-trash-purge', '17 6 * * *', $q$delete from public.task_trash where deleted_at < now() - interval '30 days'$q$);
end $$;

-- live badge "Aprovação" on the kanban cards
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_approvals') then
    alter publication supabase_realtime add table public.task_approvals;
  end if;
end $$;
