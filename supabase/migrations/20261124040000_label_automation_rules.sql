-- Automações por etiqueta: novo gatilho instantâneo "label_added" (trigger_config.label_id) — quando a etiqueta escolhida
-- é colocada num card, a ação roda na hora: definir responsável, adicionar co-responsável, alterar a capa, prioridade,
-- mover de coluna, prazo, adicionar outra etiqueta, notificar ou alertar.
-- Novas ações (valem também para os outros gatilhos instantâneos): set_cover {cover: none|blue|green|yellow|red|purple|
-- pink|orange} e add_assignee {profile_id} (co-responsável em task_assignees).
-- A execução das ações fica numa função única (apply_instant_rule_action) usada pelos dois gatilhos; erros de uma regra
-- nunca bloqueiam a mudança do card, e nada roda em cascata (pg_trigger_depth > 1).

create or replace function public.apply_instant_rule_action(_t public.tasks, _r public.task_automation_rules, _why text)
returns void language plpgsql security definer set search_path = public as $$
declare col record; d integer; uid uuid; pid uuid;
begin
  if _r.action_type = 'move_column' and _r.action_config ? 'column_id' and _t.status is distinct from _r.action_config->>'column_id' then
    select * into col from public.task_board_columns where id::text = _r.action_config->>'column_id' and board_id = _t.board_id;
    if col.id is not null then
      update public.tasks set status = col.id::text, position = 0,
        completed_at = case when col.is_conclusion then coalesce(completed_at, now()) else completed_at end,
        completed_late = case when col.is_conclusion and completed_at is null then (due_date is not null and now() > due_date) else completed_late end
      where id = _t.id;
    end if;
  elsif _r.action_type = 'set_priority' and _r.action_config ? 'priority' then
    update public.tasks set priority = _r.action_config->>'priority' where id = _t.id and priority is distinct from _r.action_config->>'priority';
  elsif _r.action_type in ('assign_to', 'add_assignee') and _r.action_config ? 'profile_id' then
    pid := (_r.action_config->>'profile_id')::uuid;
    if exists (select 1 from public.profiles p where p.id = pid and p.company_id = _t.company_id and p.is_active) then
      if _r.action_type = 'assign_to' then
        update public.tasks set assigned_to = pid where id = _t.id and assigned_to is distinct from pid;
      elsif _t.assigned_to is distinct from pid then
        insert into public.task_assignees(task_id, profile_id) select _t.id, pid
          where not exists (select 1 from public.task_assignees x where x.task_id = _t.id and x.profile_id = pid);
      end if;
    end if;
  elsif _r.action_type = 'set_cover' and coalesce(_r.action_config->>'cover', '') in ('none', 'blue', 'green', 'yellow', 'red', 'purple', 'pink', 'orange') then
    update public.tasks set cover_image = nullif(_r.action_config->>'cover', 'none') where id = _t.id and cover_image is distinct from nullif(_r.action_config->>'cover', 'none');
  elsif _r.action_type = 'add_label' and _r.action_config ? 'label_id' then
    insert into public.task_label_assignments(task_id, label_id)
      select _t.id, l.id from public.task_labels l where l.id = (_r.action_config->>'label_id')::uuid and l.board_id = _t.board_id
        and not exists (select 1 from public.task_label_assignments x where x.task_id = _t.id and x.label_id = l.id);
  elsif _r.action_type = 'set_due_days' then
    d := greatest(0, least(365, coalesce((_r.action_config->>'days')::int, 1)));
    update public.tasks set due_date = (date_trunc('day', now() at time zone 'America/Sao_Paulo') + make_interval(days => d) + interval '18 hours') at time zone 'America/Sao_Paulo' where id = _t.id;
  elsif _r.action_type = 'notify' then
    select p.user_id into uid from public.profiles p where p.id = coalesce((_r.action_config->>'profile_id')::uuid, _t.assigned_to);
    if uid is not null then
      insert into public.user_notifications(user_id, type, title, message, reference_id)
      values (uid, 'automation', 'Automação do mural', 'Card #' || coalesce(_t.task_number::text, '?') || ' "' || left(_t.title, 120) || '"' || _why, _t.id);
    end if;
  elsif _r.action_type = 'alert' and _t.assigned_to is not null then
    insert into public.workload_alerts(profile_id, board_id, alert_type, message, task_id)
    values (_t.assigned_to, _t.board_id, 'late_task', 'Card #' || coalesce(_t.task_number::text, '?') || ' "' || left(_t.title, 120) || '" requer atenção', _t.id);
  end if;
end $$;
revoke all on function public.apply_instant_rule_action(public.tasks, public.task_automation_rules, text) from public, anon, authenticated;

create or replace function public.tasks_instant_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.task_automation_rules; fire boolean;
begin
  if pg_trigger_depth() > 1 or current_setting('ewvon.restoring', true) = 'on' or coalesce(new.is_template, false) or new.board_id is null then return new; end if;
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
      perform public.apply_instant_rule_action(new, r, case r.trigger_type when 'card_created' then ' foi criado' when 'moved_to_column' then ' entrou na coluna configurada' when 'card_completed' then ' foi concluído' else ' recebeu um responsável' end);
    exception when others then null;
    end;
  end loop;
  return new;
end $$;

create or replace function public.task_label_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.task_automation_rules; t public.tasks; lname text;
begin
  if pg_trigger_depth() > 1 or current_setting('ewvon.restoring', true) = 'on' then return new; end if;
  select * into t from public.tasks where id = new.task_id;
  if t.id is null or coalesce(t.is_template, false) then return new; end if;
  select name into lname from public.task_labels where id = new.label_id;
  for r in select * from public.task_automation_rules a
           where a.is_active and a.board_id = t.board_id and (a.task_id is null or a.task_id = t.id)
             and a.trigger_type = 'label_added' and a.trigger_config->>'label_id' = new.label_id::text loop
    begin
      perform public.apply_instant_rule_action(t, r, ' recebeu a etiqueta "' || coalesce(lname, '?') || '"');
      select * into t from public.tasks where id = new.task_id;   -- next rule sees the result of the previous one
    exception when others then null;
    end;
  end loop;
  return new;
end $$;

drop trigger if exists task_label_rules on public.task_label_assignments;
create trigger task_label_rules after insert on public.task_label_assignments for each row execute function public.task_label_rules();
