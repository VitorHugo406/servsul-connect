-- Dash 3D: real admission dates (from the encrypted employee record) so headcount/turnover/tenure use real data
-- instead of the date the user was created in ewvon. Only the admission date is returned (no other personal field),
-- only for the caller's company, and only to admins or people with the Dash permission.
create or replace function public.dash_admission_dates()
returns table(profile_id uuid, admission_date date)
language plpgsql stable security definer set search_path = public, extensions as $$
declare cid uuid := public.current_company_id(); iso text := '^\d{4}-\d{2}-\d{2}$';
begin
  if cid is null then return; end if;
  if not (public.is_admin() or exists (select 1 from public.user_permissions up where up.user_id = auth.uid() and up.can_access_dash)) then return; end if;
  return query
    select x.profile_id, case when x.v ~ iso then x.v::date end
    from (
      select er.profile_id, coalesce(nullif(d->>'admission_date',''), d->>'contract_start') v
      from public.employee_records er
      cross join lateral (select pgp_sym_decrypt(er.data_enc, public.employee_data_key())::jsonb d) j
      where er.company_id = cid
    ) x
    where x.v ~ iso;
end $$;
revoke all on function public.dash_admission_dates() from public, anon;
grant execute on function public.dash_admission_dates() to authenticated;
