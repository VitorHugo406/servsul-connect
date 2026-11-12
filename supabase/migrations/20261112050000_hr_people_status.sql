-- RH e Ponto -> Dash 3D. A company connects a third-party people/time-clock system by API (or the system pushes data);
-- the edge function `hr-sync` maps it to one status per person. Only the Dash 3D reads it.
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.company_integrations'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%provider%'
  LOOP EXECUTE format('ALTER TABLE public.company_integrations DROP CONSTRAINT %I', c); END LOOP;
  ALTER TABLE public.company_integrations ADD CONSTRAINT company_integrations_provider_check CHECK (provider IN ('slack', 'teams', 'whatsapp', 'google', 'claude', 'hr'));
END $$;

CREATE TABLE IF NOT EXISTS public.hr_people_status (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'api',
  status text NOT NULL CHECK (status IN ('present', 'late', 'absent', 'vacation', 'leave', 'off')),
  clock_in timestamptz,
  hours_bank_minutes integer,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, profile_id)
);
ALTER TABLE public.hr_people_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_people_status FROM anon, authenticated;
GRANT SELECT ON public.hr_people_status TO authenticated;
DROP POLICY IF EXISTS "Admins and Dash users read people status" ON public.hr_people_status;
CREATE POLICY "Admins and Dash users read people status" ON public.hr_people_status FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (
    public.is_admin() OR EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = (select auth.uid()) AND up.can_access_dash)
  ));
CREATE INDEX IF NOT EXISTS hr_people_status_profile_idx ON public.hr_people_status (profile_id);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_people_status;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Key a third-party system uses to PUSH records (stored hashed; shown once).
CREATE TABLE IF NOT EXISTS public.hr_ingest_keys (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  key_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_ingest_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_ingest_keys FROM anon, authenticated;

-- Every 5 minutes: companies whose connector is due are synced (the function checks interval_min).
CREATE OR REPLACE FUNCTION public.hr_sync_tick() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/hr-sync/cron',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-integrations-secret', s.decrypted_secret),
    body := '{}'::jsonb
  ) FROM vault.decrypted_secrets s WHERE s.name = 'integrations_secret'
    AND EXISTS (SELECT 1 FROM public.company_integrations WHERE provider = 'hr' AND enabled AND secret_enc IS NOT NULL);
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'hr_sync_tick: %', SQLERRM;
END $$;
REVOKE EXECUTE ON FUNCTION public.hr_sync_tick() FROM public, anon, authenticated;

DO $$ BEGIN
  PERFORM cron.unschedule('ewvon-hr-sync');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('ewvon-hr-sync', '*/5 * * * *', $$SELECT public.hr_sync_tick()$$);
