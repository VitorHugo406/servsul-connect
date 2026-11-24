-- Automations, owner's rules (25/11/2026):
--  1. A person chosen in an automation (responsável, co-responsável, notificar) must be a member of the mural
--     (owner or task_board_members). Checked when the rule is saved AND again when it runs.
--  2. "Definir responsável": when the card already has a responsible person, the rule's person is added as
--     co-responsável (same weight, task_assignees) instead of replacing who is there.
--  3. apply_rule_to_existing(rule): runs a new/reactivated rule on the cards that ALREADY match it
--     (label_added → cards with that label; moved_to_column → cards in that column), not only on future ones.

create or replace function public.board_has_profile(_board uuid, _profile uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.task_boards b join public.profiles p on p.id = _profile
    where b.id = _board and p.is_active and p.company_id = b.company_id
      and (b.owner_id = p.user_id
           or exists (select 1 from public.task_board_members m where m.board_id = b.id and (m.profile_id = p.id or m.user_id = p.user_id)))
  )
$$;
revoke all on function public.board_has_profile(uuid, uuid) from public, anon;
grant execute on function public.board_has_profile(uuid, uuid) to authenticated;

-- rule saved with a person who is not in the mural → refused
create or replace function public.automation_rule_member_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if new.action_type in ('assign_to', 'add_assignee', 'notify') and coalesce(new.action_config->>'profile_id', '') <> '' then
    pid := (new.action_config->>'profile_id')::uuid;
    if not public.board_has_profile(new.board_id, pid) then
      raise exception 'AUTOMACAO_MEMBRO: a pessoa escolhida precisa ser membro deste mural';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists automation_rule_member_guard on public.task_automation_rules;
create trigger automation_rule_member_guard before insert or update of action_type, action_config on public.task_automation_rules
  for each row execute function public.automation_rule_member_guard();

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
    -- only people who are members of this mural
    if public.board_has_profile(_t.board_id, pid) then
      if _r.action_type = 'assign_to' and _t.assigned_to is null then
        update public.tasks set assigned_to = pid where id = _t.id;
      elsif _t.assigned_to is distinct from pid then
        -- someone is already responsible: the rule's person joins as co-responsável (same weight), nobody is removed
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
    pid := coalesce((_r.action_config->>'profile_id')::uuid, _t.assigned_to);
    if pid is not null and (_r.action_config->>'profile_id' is null or public.board_has_profile(_t.board_id, pid)) then
      select p.user_id into uid from public.profiles p where p.id = pid;
      if uid is not null then
        insert into public.user_notifications(user_id, type, title, message, reference_id)
        values (uid, 'automation', 'Automação do mural', 'Card #' || coalesce(_t.task_number::text, '?') || ' "' || left(_t.title, 120) || '"' || _why, _t.id);
      end if;
    end if;
  elsif _r.action_type = 'alert' and _t.assigned_to is not null then
    insert into public.workload_alerts(profile_id, board_id, alert_type, message, task_id)
    values (_t.assigned_to, _t.board_id, 'late_task', 'Card #' || coalesce(_t.task_number::text, '?') || ' "' || left(_t.title, 120) || '" requer atenção', _t.id);
  end if;
end $$;
revoke all on function public.apply_instant_rule_action(public.tasks, public.task_automation_rules, text) from public, anon, authenticated;

-- run a rule on the cards that already match it; returns how many cards it touched
create or replace function public.apply_rule_to_existing(_rule uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare r public.task_automation_rules; t public.tasks; n integer := 0; why text;
begin
  select * into r from public.task_automation_rules where id = _rule;
  if r.id is null or not r.is_active then return 0; end if;
  if not public.is_board_member(r.board_id) then raise exception 'AUTOMACAO_ACESSO: sem acesso a este mural'; end if;
  if r.trigger_type = 'label_added' and r.trigger_config ? 'label_id' then
    why := ' recebeu a etiqueta "' || coalesce((select name from public.task_labels where id = (r.trigger_config->>'label_id')::uuid), '?') || '"';
    for t in select x.* from public.tasks x
             where x.board_id = r.board_id and not coalesce(x.is_template, false) and not coalesce(x.is_archived, false)
               and (r.task_id is null or x.id = r.task_id)
               and exists (select 1 from public.task_label_assignments a where a.task_id = x.id and a.label_id::text = r.trigger_config->>'label_id') loop
      begin perform public.apply_instant_rule_action(t, r, why); n := n + 1; exception when others then null; end;
    end loop;
  elsif r.trigger_type = 'moved_to_column' and r.trigger_config ? 'column_id' then
    for t in select x.* from public.tasks x
             where x.board_id = r.board_id and not coalesce(x.is_template, false) and not coalesce(x.is_archived, false)
               and (r.task_id is null or x.id = r.task_id) and x.status = r.trigger_config->>'column_id' loop
      begin perform public.apply_instant_rule_action(t, r, ' está na coluna configurada'); n := n + 1; exception when others then null; end;
    end loop;
  end if;
  return n;
end $$;
revoke all on function public.apply_rule_to_existing(uuid) from public, anon;
grant execute on function public.apply_rule_to_existing(uuid) to authenticated;
