-- Who did what on a card, for Mural › Relatórios "Movimentações por pessoa". Moves and creation are already logged by
-- the client (log_task_activity_secure: move/moved, create/created). These triggers add, for the signed-in person:
--   checklist_add (item created), checklist_done / checklist_undone (item ticked / unticked),
--   assign (responsible changed), due (due date changed), priority (priority changed).
-- Only when auth.uid() is set (automations/cron/service writes are not counted) and never for template cards.
-- A failure here never blocks the change.
create or replace function public.task_log_auto(_task uuid, _type text, _desc text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nm text;
begin
  if uid is null then return; end if;
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
