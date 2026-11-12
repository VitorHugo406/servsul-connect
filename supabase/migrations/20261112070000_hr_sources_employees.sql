-- RH -> Dash 3D, v3: the Dash can run on the people of external HR systems (Convenia, Pontomais, Ahgora, ...) instead of the
-- ewvon roster. A company can connect several systems (hr_sources); every person of each system is stored (hr_employees)
-- with the registry data (admission, dismissal, salary, department, role, sex, birth, contract). Time-clock data is NOT imported.
CREATE TABLE IF NOT EXISTS public.hr_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  preset text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_enc text,
  enabled boolean NOT NULL DEFAULT true,
  last_status text,
  last_error text,
  last_used_at timestamptz,
  last_count integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hr_sources_company_idx ON public.hr_sources (company_id);
ALTER TABLE public.hr_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_sources FROM anon, authenticated;
GRANT SELECT (id, company_id, label, preset, config, enabled, last_status, last_error, last_used_at, last_count, created_at, updated_at) ON public.hr_sources TO authenticated;
DROP POLICY IF EXISTS "Company admins read HR sources" ON public.hr_sources;
CREATE POLICY "Company admins read HR sources" ON public.hr_sources FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin());

CREATE TABLE IF NOT EXISTS public.hr_employees (
  source_id uuid NOT NULL REFERENCES public.hr_sources(id) ON DELETE CASCADE,
  ext_key text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text, depto text, cargo text, sexo text, ctr text, cc text, kemp text,
  adm date, dem date, nasc date,
  salary numeric, vacation_overdue numeric,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, ext_key)
);
CREATE INDEX IF NOT EXISTS hr_employees_company_idx ON public.hr_employees (company_id);
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_employees FROM anon, authenticated;
GRANT SELECT ON public.hr_employees TO authenticated;
DROP POLICY IF EXISTS "Admins and Dash users read HR employees" ON public.hr_employees;
CREATE POLICY "Admins and Dash users read HR employees" ON public.hr_employees FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (
    public.is_admin() OR EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = (select auth.uid()) AND up.can_access_dash)
  ));
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_sources; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The cron tick now looks at hr_sources.
CREATE OR REPLACE FUNCTION public.hr_sync_tick() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/hr-sync/cron',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-integrations-secret', s.decrypted_secret),
    body := '{}'::jsonb
  ) FROM vault.decrypted_secrets s WHERE s.name = 'integrations_secret'
    AND EXISTS (SELECT 1 FROM public.hr_sources WHERE enabled AND secret_enc IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'hr_sync_tick: %', SQLERRM;
END $$;
REVOKE EXECUTE ON FUNCTION public.hr_sync_tick() FROM public, anon, authenticated;

-- Time-clock status table and push keys of the previous version are no longer used.
DROP TABLE IF EXISTS public.hr_people_status;
DROP TABLE IF EXISTS public.hr_ingest_keys;
DELETE FROM public.company_integrations WHERE provider = 'hr';
