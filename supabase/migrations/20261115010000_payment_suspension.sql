-- Payment pending -> 3 days -> company access suspended (every user) until the payment is regularized;
-- data kept 30 days after the suspension. Plans exempt/free/trialing and the system company are never suspended.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE public.company_subscriptions
  ADD COLUMN IF NOT EXISTS pending_notice_for timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_notice_for timestamptz,
  ADD COLUMN IF NOT EXISTS export_notice_for timestamptz,
  ADD COLUMN IF NOT EXISTS final_notice_for timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_asked_for timestamptz;

-- A manual payment to regularize a late subscription is a new kind of order/payment.
ALTER TABLE public.billing_orders DROP CONSTRAINT IF EXISTS billing_orders_kind_check;
ALTER TABLE public.billing_orders ADD CONSTRAINT billing_orders_kind_check CHECK (kind IN ('extra_users', 'extra_storage', 'once_renewal', 'plan_change', 'regularize'));
ALTER TABLE public.company_payments DROP CONSTRAINT IF EXISTS company_payments_kind_check;
ALTER TABLE public.company_payments ADD CONSTRAINT company_payments_kind_check CHECK (kind IN ('signup', 'renewal', 'extra_users', 'extra_storage', 'once_renewal', 'plan_change', 'regularize'));

-- The e-mail used to create the company (the only one that sees payment data and can export the company data).
CREATE OR REPLACE FUNCTION public.company_owner_email(_cid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(coalesce(
    (SELECT s.admin_email FROM public.company_signups s WHERE s.company_id = _cid AND s.status = 'active' ORDER BY s.created_at LIMIT 1),
    (SELECT p.email FROM public.profiles p WHERE p.company_id = _cid AND p.autonomy_level = 'admin' AND p.is_active ORDER BY p.created_at LIMIT 1)))
$$;
REVOKE ALL ON FUNCTION public.company_owner_email(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.company_is_suspended_calc(_cid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_subscriptions s JOIN public.companies c ON c.id = s.company_id
     WHERE s.company_id = _cid AND NOT c.is_system AND s.plan_id IS NOT NULL AND s.trial_ends_at IS NULL
       AND s.status IN ('active', 'past_due', 'canceled') AND s.current_period_end IS NOT NULL AND s.current_period_end <= now());
$$;
REVOKE ALL ON FUNCTION public.company_is_suspended_calc(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_one_company_suspension(_cid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE calc boolean; pe timestamptz;
BEGIN
  calc := public.company_is_suspended_calc(_cid);
  SELECT current_period_end INTO pe FROM public.company_subscriptions WHERE company_id = _cid;
  UPDATE public.companies SET is_suspended = calc, suspended_at = CASE WHEN calc THEN coalesce(suspended_at, pe) ELSE NULL END
   WHERE id = _cid AND (is_suspended IS DISTINCT FROM calc OR (calc AND suspended_at IS NULL) OR (NOT calc AND suspended_at IS NOT NULL));
END $$;
REVOKE ALL ON FUNCTION public.sync_one_company_suspension(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_company_suspensions() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT company_id FROM public.company_subscriptions WHERE current_period_end IS NOT NULL OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.is_suspended) LOOP
    PERFORM public.sync_one_company_suspension(r.company_id); n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.sync_company_suspensions() FROM PUBLIC, anon, authenticated;

-- Any change to the subscription (payment applied, plan changed...) re-evaluates the suspension right away.
CREATE OR REPLACE FUNCTION public.company_subscriptions_sync_suspension() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_one_company_suspension(NEW.company_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS company_subscriptions_suspension ON public.company_subscriptions;
CREATE TRIGGER company_subscriptions_suspension AFTER INSERT OR UPDATE OF status, current_period_end, plan_id, trial_ends_at ON public.company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.company_subscriptions_sync_suspension();

-- The whole tenant isolation (72 policies) goes through current_company_id(): a suspended company has none, so its data is closed to every user.
CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.company_id FROM public.profiles p JOIN public.companies c ON c.id = p.company_id
   WHERE p.user_id = auth.uid() AND p.is_active = true AND NOT c.is_suspended
   LIMIT 1
$$;

-- A suspended user must still read their own profile (the app needs it to show the suspension screen).
DROP POLICY IF EXISTS "Users view their own profile" ON public.profiles;
CREATE POLICY "Users view their own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- What the app needs to warn about / explain the suspension. Payment data only for the e-mail that created the company.
CREATE OR REPLACE FUNCTION public.get_my_billing_gate() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; c record; s record; cfg record; owner text; blk timestamptz; due timestamptz; st text; amount int; pl record; hint text; mine boolean;
BEGIN
  SELECT pr.company_id, lower(pr.email) AS email INTO p FROM public.profiles pr WHERE pr.user_id = auth.uid() AND pr.is_active LIMIT 1;
  IF p.company_id IS NULL THEN RETURN jsonb_build_object('state', 'ok'); END IF;
  SELECT * INTO c FROM public.companies WHERE id = p.company_id;
  IF c.is_system THEN RETURN jsonb_build_object('state', 'ok'); END IF;
  SELECT * INTO s FROM public.company_subscriptions WHERE company_id = p.company_id;
  IF s.company_id IS NULL OR s.plan_id IS NULL OR s.trial_ends_at IS NOT NULL OR s.status NOT IN ('active', 'past_due', 'canceled') OR s.current_period_end IS NULL THEN
    RETURN jsonb_build_object('state', 'ok');
  END IF;
  blk := s.current_period_end; due := blk - interval '3 days';
  st := CASE WHEN now() >= blk THEN 'blocked'
             WHEN now() >= due + (CASE WHEN s.provider_subscription_id IS NOT NULL THEN interval '6 hours' ELSE interval '0' END) THEN 'pending'
             ELSE 'ok' END;
  IF st = 'ok' THEN RETURN jsonb_build_object('state', 'ok'); END IF;
  owner := public.company_owner_email(p.company_id);
  mine := owner IS NOT NULL AND p.email = owner;
  SELECT * INTO pl FROM public.subscription_plans WHERE id = s.plan_id;
  SELECT * INTO cfg FROM public.billing_settings LIMIT 1;
  amount := coalesce(pl.price_cents, 0) + coalesce(s.extra_users, 0) * coalesce(cfg.extra_user_cents, 0)
            + CASE WHEN coalesce(cfg.storage_pack_gb, 0) > 0 THEN ceil(coalesce(s.extra_storage_gb, 0)::numeric / cfg.storage_pack_gb)::int * coalesce(cfg.storage_pack_cents, 0) ELSE 0 END;
  hint := CASE WHEN owner IS NULL THEN NULL ELSE left(split_part(owner, '@', 1), 1) || repeat('*', greatest(2, length(split_part(owner, '@', 1)) - 1)) || '@' || split_part(owner, '@', 2) END;
  RETURN jsonb_build_object('state', st, 'company_name', c.name, 'plan_name', pl.name, 'due_at', due, 'blocked_at', blk, 'delete_at', blk + interval '30 days',
    'days_to_block', greatest(0, ceil(extract(epoch FROM (blk - now())) / 86400))::int, 'days_to_delete', greatest(0, ceil(extract(epoch FROM (blk + interval '30 days' - now())) / 86400))::int,
    'is_owner', mine, 'owner_hint', hint, 'auto_renewal', s.provider_subscription_id IS NOT NULL, 'billing_cycle', s.billing_cycle,
    'amount_cents', CASE WHEN mine OR st = 'pending' THEN amount ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.get_my_billing_gate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_billing_gate() TO authenticated;

-- Private bucket for the company data exports (only the server reads/writes it).
INSERT INTO storage.buckets (id, name, public) VALUES ('company-exports', 'company-exports', false) ON CONFLICT (id) DO NOTHING;

SELECT cron.unschedule('ewvon-company-suspensions') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ewvon-company-suspensions');
SELECT cron.schedule('ewvon-company-suspensions', '*/2 * * * *', $cron$SELECT public.sync_company_suspensions()$cron$);
