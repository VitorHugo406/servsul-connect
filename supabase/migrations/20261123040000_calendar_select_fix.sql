-- Calendário: criar um evento e devolvê-lo na mesma requisição falhava ("new row violates row-level security policy"),
-- porque a política de leitura usava can_view_calendar_event(id, created_by), uma função STABLE que procura o próprio
-- evento na tabela — e a linha recém-inserida ainda não é visível para ela dentro do mesmo comando. Resultado: nenhum
-- evento chegava a ser criado pelo app. A nova política lê as colunas da própria linha (mesmo acesso de antes:
-- quem criou, admin da empresa ou participante), e só a consulta de participante vai a outra tabela.
create or replace function public.is_event_participant(_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.meeting_participants mp where mp.event_id = _event and mp.profile_id = public.get_current_profile_id())
$$;
revoke all on function public.is_event_participant(uuid) from public, anon;
grant execute on function public.is_event_participant(uuid) to authenticated;

drop policy if exists "Users can view own or invited calendar events" on public.calendar_events;
create policy "Users can view own or invited calendar events" on public.calendar_events for select to authenticated
  using ((select auth.uid()) is not null and public.same_company(company_id)
    and (created_by = (select auth.uid()) or public.is_admin() or public.is_event_participant(id)));
