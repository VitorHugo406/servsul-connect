-- Simplified performance evaluations.
-- Flow: draft (avaliador preenche) -> sent (aguardando ciência do colaborador)
--   -> finalized (colaborador deu ciência)   or   -> contested (pediu revisão) -> sent ...
-- Criteria = eval_competencies (score 1..5 per item). Cargos/ciclos are no longer used by the UI.

alter table public.evaluations
  add column if not exists period_label text,
  add column if not exists strengths text,
  add column if not exists improvements text,
  add column if not exists acknowledged_at timestamptz;

-- The evaluated person never sees drafts and can no longer edit the row directly:
-- they answer through evaluation_respond().
drop policy if exists "Users can view own evaluations" on public.evaluations;
create policy "Users can view own evaluations" on public.evaluations for select using (
  same_company(company_id) and (
    evaluator_id = get_current_profile_id() or is_admin() or has_autonomy_level('supervisor')
    or (evaluated_id = get_current_profile_id() and status <> 'draft')
  )
);

drop policy if exists "Evaluators can update evaluations" on public.evaluations;
create policy "Evaluators can update evaluations" on public.evaluations for update using (
  same_company(company_id) and (evaluator_id = get_current_profile_id() or is_admin() or has_autonomy_level('supervisor'))
) with check (
  same_company(company_id) and (evaluator_id = get_current_profile_id() or is_admin() or has_autonomy_level('supervisor'))
);

drop policy if exists "Evaluators can create evaluations" on public.evaluations;
create policy "Evaluators can create evaluations" on public.evaluations for insert with check (
  same_company(company_id) and (is_admin() or has_autonomy_level('supervisor'))
  and evaluator_id = get_current_profile_id() and evaluated_id <> get_current_profile_id()
);

drop policy if exists "Evaluated can respond to items" on public.evaluation_items;
drop policy if exists "Users can view evaluation items" on public.evaluation_items;
create policy "Users can view evaluation items" on public.evaluation_items for select using (
  exists (select 1 from public.evaluations e where e.id = evaluation_items.evaluation_id and same_company(e.company_id) and (
    e.evaluator_id = get_current_profile_id() or is_admin() or has_autonomy_level('supervisor')
    or (e.evaluated_id = get_current_profile_id() and e.status <> 'draft')))
);

-- Overall score is always the weighted average of the scored items.
create or replace function public.evaluation_recalc_score()
returns trigger language plpgsql security definer set search_path = public as $$
declare _id uuid := coalesce(new.evaluation_id, old.evaluation_id);
begin
  update public.evaluations e set overall_score = (
    select case when sum(i.weight) filter (where i.score is not null) > 0
      then round(sum(i.score * i.weight) filter (where i.score is not null) / sum(i.weight) filter (where i.score is not null), 2) end
    from public.evaluation_items i where i.evaluation_id = _id
  ), updated_at = now() where e.id = _id;
  return null;
end $$;

drop trigger if exists evaluation_items_recalc on public.evaluation_items;
create trigger evaluation_items_recalc after insert or update of score, weight or delete on public.evaluation_items
for each row execute function public.evaluation_recalc_score();

-- The evaluated person acknowledges (finalizes) or asks for a review.
create or replace function public.evaluation_respond(_id uuid, _accept boolean, _comment text default null)
returns public.evaluations language plpgsql security definer set search_path = public as $$
declare _e public.evaluations; _me uuid := get_current_profile_id(); _c text := nullif(btrim(coalesce(_comment, '')), '');
begin
  select * into _e from public.evaluations where id = _id for update;
  if _e.id is null or _me is null or _e.evaluated_id <> _me or not same_company(_e.company_id) then
    raise exception 'Avaliação não encontrada';
  end if;
  if _e.status <> 'sent' then raise exception 'Esta avaliação não está aguardando sua ciência'; end if;
  if not _accept and _c is null then raise exception 'Explique o que precisa ser revisado'; end if;

  update public.evaluations set
    status = case when _accept then 'finalized' else 'contested' end,
    evaluated_comment = _c,
    responded_at = now(),
    acknowledged_at = case when _accept then now() else null end,
    finalized_at = case when _accept then now() else null end,
    updated_at = now()
  where id = _id returning * into _e;

  insert into public.evaluation_history (evaluation_id, action, performed_by, old_status, new_status, details)
  values (_id, case when _accept then 'acknowledged' else 'review_requested' end, _me, 'sent', _e.status, _c);
  return _e;
end $$;

revoke all on function public.evaluation_respond(uuid, boolean, text) from public, anon;
grant execute on function public.evaluation_respond(uuid, boolean, text) to authenticated;
revoke all on function public.evaluation_recalc_score() from public, anon, authenticated;
