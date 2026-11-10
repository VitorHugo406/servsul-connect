-- Trial lifecycle: "avaliação até <data>" -> 7-day notice -> expiry (30 days to subscribe) -> after 30 days
-- the super admin gets a "Comunicados" message with two buttons (delete the company's data / keep it).
-- The daily edge function `trial-lifecycle` does the sending; deletion only ever happens when the
-- super admin presses the button (resolve_company_deletion), never automatically.

ALTER TABLE public.company_subscriptions
  ADD COLUMN IF NOT EXISTS trial_notice_7d_for timestamptz,
  ADD COLUMN IF NOT EXISTS trial_notice_expired_for timestamptz,
  ADD COLUMN IF NOT EXISTS trial_deletion_asked_for timestamptz;

-- No FK to companies on purpose: the row must survive the company's deletion (it is the record of the decision).
CREATE TABLE IF NOT EXISTS public.company_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  company_name text NOT NULL,
  trial_ends_at timestamptz,
  people integer NOT NULL DEFAULT 0,
  storage_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'failed')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
ALTER TABLE public.company_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_deletion_requests FROM anon, authenticated;
GRANT SELECT ON public.company_deletion_requests TO authenticated;
DROP POLICY IF EXISTS "Super admin reads deletion requests" ON public.company_deletion_requests;
CREATE POLICY "Super admin reads deletion requests" ON public.company_deletion_requests FOR SELECT TO authenticated USING (public.is_super_admin());

-- The two buttons of the message. Only the super admin; only while pending; only when the company is
-- still without a paid plan and the 30 days really passed.
CREATE OR REPLACE FUNCTION public.resolve_company_deletion(_request_id uuid, _approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.company_deletion_requests; c public.companies; s public.company_subscriptions; res jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Apenas o super administrador' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.company_deletion_requests WHERE id = _request_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF r.status <> 'pending' THEN RETURN jsonb_build_object('status', r.status, 'already', true); END IF;
  IF NOT _approve THEN
    UPDATE public.company_deletion_requests SET status = 'declined', decided_at = now() WHERE id = r.id;
    RETURN jsonb_build_object('status', 'declined');
  END IF;
  SELECT * INTO c FROM public.companies WHERE id = r.company_id;
  IF c.id IS NULL THEN
    UPDATE public.company_deletion_requests SET status = 'approved', decided_at = now(), result = '{"note":"empresa já não existe"}' WHERE id = r.id;
    RETURN jsonb_build_object('status', 'approved');
  END IF;
  IF c.is_system THEN RAISE EXCEPTION 'A empresa do sistema não pode ser excluída'; END IF;
  SELECT * INTO s FROM public.company_subscriptions WHERE company_id = c.id;
  IF s.status IN ('active', 'exempt', 'free') THEN
    UPDATE public.company_deletion_requests SET status = 'declined', decided_at = now(), result = '{"note":"empresa passou a ter plano; nada excluído"}' WHERE id = r.id;
    RETURN jsonb_build_object('status', 'declined', 'note', 'A empresa passou a ter um plano ativo; nada foi excluído.');
  END IF;
  res := public.super_admin_delete_company(c.id, c.name);
  UPDATE public.company_deletion_requests SET status = 'approved', decided_at = now(), result = res WHERE id = r.id;
  RETURN jsonb_build_object('status', 'approved') || coalesce(res, '{}'::jsonb);
END $$;
REVOKE EXECUTE ON FUNCTION public.resolve_company_deletion(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.resolve_company_deletion(uuid, boolean) TO authenticated;

-- Daily run (08:30 São Paulo), same Vault secret as the billing reconcile.
SELECT cron.unschedule('ewvon-trial-lifecycle') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ewvon-trial-lifecycle');
SELECT cron.schedule('ewvon-trial-lifecycle', '30 11 * * *', $cron$
  SELECT net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/trial-lifecycle',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-billing-cron', s.decrypted_secret),
    body := '{}'::jsonb
  ) FROM vault.decrypted_secrets s WHERE s.name = 'billing_cron_secret'
$cron$);
