-- System storage capacity (what the Supabase plan allows vs what was sold to companies) and the
-- bookkeeping for automatic reminders (expiry e-mails, near-full storage notices).

ALTER TABLE public.billing_settings
  ADD COLUMN IF NOT EXISTS project_storage_gb numeric NOT NULL DEFAULT 1,   -- Supabase Free: 1 GB of files
  ADD COLUMN IF NOT EXISTS project_db_mb integer NOT NULL DEFAULT 500,      -- Supabase Free: 500 MB database
  ADD COLUMN IF NOT EXISTS capacity_alert_state text;

ALTER TABLE public.company_subscriptions
  ADD COLUMN IF NOT EXISTS reminder_sent_for timestamptz,
  ADD COLUMN IF NOT EXISTS storage_alert_level integer NOT NULL DEFAULT 0;

-- Overview for the super admin Storage tab and the billing alerts.
CREATE OR REPLACE FUNCTION public.system_storage_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE cfg record; r jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO cfg FROM public.billing_settings LIMIT 1;
  WITH comp AS (
    SELECT c.id, c.name, l.storage_bytes AS limit_bytes, public.company_storage_used(c.id) AS used_bytes
    FROM public.companies c
    JOIN public.company_subscriptions s ON s.company_id = c.id
    CROSS JOIN LATERAL public.company_limits(c.id) l
    WHERE NOT c.is_system AND s.status IN ('active', 'trialing', 'past_due') AND l.storage_bytes IS NOT NULL
  )
  SELECT jsonb_build_object(
    'capacity_bytes', (coalesce(cfg.project_storage_gb, 1) * 1024 * 1024 * 1024)::bigint,
    'db_capacity_bytes', (coalesce(cfg.project_db_mb, 500)::bigint * 1024 * 1024),
    'committed_bytes', coalesce((SELECT sum(limit_bytes) FROM comp), 0)::bigint,
    'files_bytes', (SELECT coalesce(sum(coalesce((metadata->>'size')::bigint, 0)), 0) FROM storage.objects)::bigint,
    'db_bytes', pg_database_size(current_database()),
    'project_storage_gb', cfg.project_storage_gb, 'project_db_mb', cfg.project_db_mb,
    'companies', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'limit_bytes', limit_bytes, 'used_bytes', used_bytes) ORDER BY used_bytes DESC) FROM comp), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.system_storage_overview() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.system_storage_overview() TO authenticated, service_role;

-- Super admin: what the Supabase plan allows (after an upgrade).
CREATE OR REPLACE FUNCTION public.set_project_capacity(_storage_gb numeric, _db_mb integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _storage_gb <= 0 OR _db_mb <= 0 THEN RAISE EXCEPTION 'invalid'; END IF;
  UPDATE public.billing_settings SET project_storage_gb = _storage_gb, project_db_mb = _db_mb, capacity_alert_state = NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_project_capacity(numeric, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_project_capacity(numeric, integer) TO authenticated;
