-- Self-service company sign-up paid through Mercado Pago (monthly subscription / preapproval).
-- Flow: the visitor fills company + admin data -> a signup row is stored (password encrypted by the
-- billing edge function, wiped after provisioning) -> Mercado Pago checkout -> the billing function
-- confirms the payment with Mercado Pago's API (never trusting the notification body) -> the company,
-- its subscription and its admin are created. Only the service role touches these tables; the super
-- admin can read the signups (without secrets) to follow up.

CREATE TABLE IF NOT EXISTS public.company_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'provisioning', 'active', 'failed', 'expired', 'canceled')),
  plan_id text NOT NULL REFERENCES public.subscription_plans(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  company_name text NOT NULL,
  slug text NOT NULL,
  primary_color text NOT NULL,
  secondary_color text NOT NULL,
  logo_path text,
  admin_name text NOT NULL,
  admin_email text NOT NULL,
  password_enc text,
  status_token_hash text NOT NULL,
  preapproval_id text UNIQUE,
  checkout_url text,
  last_payment_id text,
  paid_at timestamptz,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS company_signups_open_email ON public.company_signups (lower(admin_email))
  WHERE status IN ('pending_payment', 'provisioning', 'failed');
CREATE INDEX IF NOT EXISTS company_signups_status ON public.company_signups (status, created_at);

ALTER TABLE public.company_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_signups FROM anon, authenticated;
GRANT SELECT (id, status, plan_id, amount_cents, company_name, slug, admin_name, admin_email, preapproval_id,
  last_payment_id, paid_at, company_id, error, attempts, created_at, updated_at, activated_at)
  ON public.company_signups TO authenticated;
DROP POLICY IF EXISTS "Super admin reads signups" ON public.company_signups;
CREATE POLICY "Super admin reads signups" ON public.company_signups FOR SELECT TO authenticated USING (public.is_super_admin());

-- Every notification received from the payment provider (idempotency + audit).
CREATE TABLE IF NOT EXISTS public.payment_events (
  id bigserial PRIMARY KEY,
  provider text NOT NULL,
  topic text NOT NULL,
  resource_id text NOT NULL,
  signature_ok boolean,
  result text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_events_resource ON public.payment_events (provider, resource_id);
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_events FROM anon, authenticated;
DROP POLICY IF EXISTS "Super admin reads payment events" ON public.payment_events;
GRANT SELECT ON public.payment_events TO authenticated;
CREATE POLICY "Super admin reads payment events" ON public.payment_events FOR SELECT TO authenticated USING (public.is_super_admin());

-- Hourly reconciliation (catches any lost notification and retries failed provisioning). The shared
-- secret lives only in Vault; the edge function checks it through billing_cron_secret_ok().
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'billing_cron_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'billing_cron_secret', 'Billing reconcile cron');
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.billing_cron_secret_ok(_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT decrypted_secret = _secret FROM vault.decrypted_secrets WHERE name = 'billing_cron_secret'), false)
$$;
REVOKE EXECUTE ON FUNCTION public.billing_cron_secret_ok(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_cron_secret_ok(text) TO service_role;

SELECT cron.unschedule('ewvon-billing-reconcile') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ewvon-billing-reconcile');
SELECT cron.schedule('ewvon-billing-reconcile', '7 * * * *', $cron$
  SELECT net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/billing/reconcile',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-billing-cron', s.decrypted_secret),
    body := '{}'::jsonb
  ) FROM vault.decrypted_secrets s WHERE s.name = 'billing_cron_secret'
$cron$);
