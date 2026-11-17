-- Gestão de Pessoas > Alertas: settings per team (design Tela_de_Avisos_10).
alter table public.teams
  add column if not exists alerts_enabled boolean not null default true,
  add column if not exists alert_times text[] not null default '{09:00}',
  add column if not exists alert_days smallint[] not null default '{1,2,3,4,5}',
  add column if not exists alert_types text[] not null default '{late_task,deadline_risk,stuck_task,overloaded}',
  add column if not exists alert_chat boolean not null default true;

create or replace function public.valid_alert_times(_t text[]) returns boolean
language sql immutable set search_path = public as $$
  select cardinality(coalesce(_t, '{}')) <= 6 and not exists (select 1 from unnest(coalesce(_t, '{}')) x where x !~ '^([01][0-9]|2[0-3]):(00|30)$')
$$;

alter table public.teams drop constraint if exists teams_alert_settings_ok;
alter table public.teams add constraint teams_alert_settings_ok check (
  public.valid_alert_times(alert_times)
  and alert_days <@ '{0,1,2,3,4,5,6}'::smallint[]
  and alert_types <@ '{late_task,deadline_risk,stuck_task,overloaded}'::text[]
);

-- carry over each supervisor's old personal setting to their teams (times rounded down to :00/:30)
update public.teams t set alerts_enabled = p.team_alerts_enabled,
  alert_times = coalesce(nullif(array(
    select distinct substr(x, 1, 3) || case when substr(x, 4, 2)::int < 30 then '00' else '30' end
    from unnest(p.team_alert_times) x where x ~ '^([01][0-9]|2[0-3]):[0-5][0-9]'), '{}'), '{09:00}')
from public.profiles p where p.user_id = t.supervisor_id and p.company_id = t.company_id;

-- the scheduled team alerts were never triggered: run every 30 min (process-automations checks each team's hours/days)
select cron.unschedule(jobid) from cron.job where jobname = 'ewvon-team-alerts';
select cron.schedule('ewvon-team-alerts', '1,31 * * * *', $$
  SELECT net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/process-automations',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-billing-cron', s.decrypted_secret),
    body := '{"time":"alerts"}'::jsonb
  ) FROM vault.decrypted_secrets s WHERE s.name = 'billing_cron_secret'
$$);
