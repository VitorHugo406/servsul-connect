-- Reuniões com local definido + exclusões no RH.
--  * calendar_events.location (texto livre: "Presencial – recepção") e calendar_events.booking_id (reserva de sala
--    criada junto com a reunião). Excluir a reunião apaga a reserva da sala.
--  * one_on_ones.event_id / duration_min: cada 1:1 vira uma reunião no calendário (com a sala, a chamada do ewvon ou o
--    link externo). Excluir a 1:1 apaga a reunião do calendário (e a reserva da sala).
--  * Excluir 1:1: gestor que marcou ou admin. Excluir ausência: a própria pessoa (menos uma ausência aprovada que ainda
--    não terminou — essa se cancela), o gestor de quem pediu ou um admin.
alter table public.calendar_events add column if not exists location text check (location is null or length(location) <= 300);
alter table public.calendar_events add column if not exists booking_id uuid references public.meeting_bookings(id) on delete set null;

alter table public.one_on_ones add column if not exists event_id uuid references public.calendar_events(id) on delete set null;
alter table public.one_on_ones add column if not exists duration_min int not null default 30 check (duration_min between 10 and 480);

create or replace function public.calendar_event_cleanup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.booking_id is not null then delete from public.meeting_bookings where id = old.booking_id; end if;
  return old;
end $$;
drop trigger if exists calendar_event_cleanup on public.calendar_events;
create trigger calendar_event_cleanup after delete on public.calendar_events for each row execute function public.calendar_event_cleanup();

create or replace function public.one_on_one_cleanup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.event_id is not null then delete from public.calendar_events where id = old.event_id; end if;
  return old;
end $$;
drop trigger if exists one_on_one_cleanup on public.one_on_ones;
create trigger one_on_one_cleanup after delete on public.one_on_ones for each row execute function public.one_on_one_cleanup();

drop policy if exists "Manager deletes 1:1" on public.one_on_ones;
create policy "Manager deletes 1:1" on public.one_on_ones for delete to authenticated
  using (public.same_company(company_id) and (manager_id = public.get_current_profile_id() or public.is_admin()));

drop policy if exists "Delete time off" on public.time_off_requests;
create policy "Delete time off" on public.time_off_requests for delete to authenticated
  using (public.same_company(company_id) and (
    (profile_id = public.get_current_profile_id() and not (status = 'approved' and end_date >= current_date))
    or public.manages_profile(profile_id) or public.is_admin()));
grant delete on public.time_off_requests to authenticated;
