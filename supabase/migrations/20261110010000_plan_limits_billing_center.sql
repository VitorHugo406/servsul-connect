-- Plan limits, add-ons and billing history.
-- * company_subscriptions.extra_users / extra_storage_gb: paid add-ons (summed to the subscription).
-- * billing_settings: add-on prices (R$ 9,90 per user / month, R$ 9,90 per 5 GB / month).
-- * company_limits(): users / sectors / storage limits (NULL = unlimited: system or exempt company, or no plan).
-- * Triggers block activating users or creating sectors above the limit; a restrictive storage policy
--   blocks uploads once the company reaches its storage limit.
-- * company_payments: every confirmed payment; billing_orders: add-on purchases and one-time renewals.

ALTER TABLE public.company_subscriptions
  ADD COLUMN IF NOT EXISTS extra_users integer NOT NULL DEFAULT 0 CHECK (extra_users >= 0),
  ADD COLUMN IF NOT EXISTS extra_storage_gb integer NOT NULL DEFAULT 0 CHECK (extra_storage_gb >= 0);

CREATE TABLE IF NOT EXISTS public.billing_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  extra_user_cents integer NOT NULL DEFAULT 990,
  storage_pack_gb integer NOT NULL DEFAULT 5,
  storage_pack_cents integer NOT NULL DEFAULT 990,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.billing_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_settings FROM anon, authenticated;
GRANT SELECT ON public.billing_settings TO authenticated;
DROP POLICY IF EXISTS "Signed-in users read billing settings" ON public.billing_settings;
CREATE POLICY "Signed-in users read billing settings" ON public.billing_settings FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.company_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_payment_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('signup', 'renewal', 'extra_users', 'extra_storage', 'once_renewal')),
  description text,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  paid_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id)
);
CREATE INDEX IF NOT EXISTS company_payments_company ON public.company_payments (company_id, paid_at DESC);
ALTER TABLE public.company_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_payments FROM anon, authenticated;
GRANT SELECT ON public.company_payments TO authenticated;
DROP POLICY IF EXISTS "Company admins read payments" ON public.company_payments;
CREATE POLICY "Company admins read payments" ON public.company_payments FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (company_id = public.current_company_id() AND public.is_admin()));

CREATE TABLE IF NOT EXISTS public.billing_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('extra_users', 'extra_storage', 'once_renewal')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 500),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'canceled')),
  mp_preference_id text,
  checkout_url text,
  payment_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS billing_orders_open ON public.billing_orders (status, created_at);
ALTER TABLE public.billing_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_orders FROM anon, authenticated;
GRANT SELECT ON public.billing_orders TO authenticated;
DROP POLICY IF EXISTS "Company admins read orders" ON public.billing_orders;
CREATE POLICY "Company admins read orders" ON public.billing_orders FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (company_id = public.current_company_id() AND public.is_admin()));

-- Limits ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.company_limits(_company_id uuid)
RETURNS TABLE (max_users integer, max_sectors integer, storage_bytes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE WHEN unlimited THEN NULL ELSE p.max_users + s.free_seats + s.extra_users END,
    CASE WHEN unlimited THEN NULL ELSE p.max_sectors END,
    CASE WHEN unlimited THEN NULL ELSE (p.storage_gb + s.extra_storage_gb)::bigint * 1024 * 1024 * 1024 END
  FROM (SELECT 1) one
  LEFT JOIN public.company_subscriptions s ON s.company_id = _company_id
  LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
  CROSS JOIN LATERAL (SELECT (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = _company_id AND c.is_system)
                              OR s.status IS NULL OR s.status = 'exempt' OR p.id IS NULL) AS unlimited) u
$$;
REVOKE EXECUTE ON FUNCTION public.company_limits(uuid) FROM public, anon, authenticated;

-- Which company owns a storage object (first path segment is a company id, a user/profile id, the
-- company slug for logos, or feedback/<month>/<profile>.pdf).
CREATE OR REPLACE FUNCTION public.storage_object_company(_bucket text, _name text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH seg AS (SELECT split_part(_name, '/', 1) AS a, split_part(split_part(_name, '/', 3), '.', 1) AS c)
  SELECT coalesce(
    (SELECT id FROM public.companies WHERE id::text = seg.a),
    (SELECT company_id FROM public.profiles WHERE user_id::text = seg.a OR id::text = seg.a LIMIT 1),
    CASE WHEN _bucket = 'company-logos' THEN (SELECT id FROM public.companies WHERE slug = seg.a) END,
    CASE WHEN seg.a = 'feedback' THEN (SELECT company_id FROM public.profiles WHERE id::text = seg.c LIMIT 1) END
  ) FROM seg
$$;
REVOKE EXECUTE ON FUNCTION public.storage_object_company(text, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.company_storage_used(_company_id uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT coalesce(sum(coalesce((o.metadata->>'size')::bigint, 0)), 0)::bigint
  FROM storage.objects o WHERE public.storage_object_company(o.bucket_id, o.name) = _company_id
$$;
REVOKE EXECUTE ON FUNCTION public.company_storage_used(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.storage_quota_ok(_bucket text, _name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; lim bigint;
BEGIN
  cid := public.storage_object_company(_bucket, _name);
  IF cid IS NULL THEN RETURN true; END IF;
  SELECT storage_bytes INTO lim FROM public.company_limits(cid);
  IF lim IS NULL THEN RETURN true; END IF;
  RETURN public.company_storage_used(cid) < lim;
END $$;
REVOKE EXECUTE ON FUNCTION public.storage_quota_ok(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.storage_quota_ok(text, text) TO authenticated;

DROP POLICY IF EXISTS "Plan storage limit" ON storage.objects;
CREATE POLICY "Plan storage limit" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.storage_quota_ok(bucket_id, name));

CREATE OR REPLACE FUNCTION public.enforce_company_user_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lim integer; used integer;
BEGIN
  IF NOT NEW.is_active OR coalesce(NEW.profile_type, 'user') IN ('system', 'bot') OR NEW.company_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_active AND OLD.company_id IS NOT DISTINCT FROM NEW.company_id THEN RETURN NEW; END IF;
  SELECT max_users INTO lim FROM public.company_limits(NEW.company_id);
  IF lim IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO used FROM public.profiles
   WHERE company_id = NEW.company_id AND is_active AND coalesce(profile_type, 'user') NOT IN ('system', 'bot') AND id <> NEW.id;
  IF used >= lim THEN
    RAISE EXCEPTION 'LIMITE_USUARIOS: o plano permite % usuários ativos. Compre usuários extras na aba Pagamentos ou desative alguém.', lim USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_company_user_limit() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_user_limit ON public.profiles;
CREATE TRIGGER profiles_user_limit BEFORE INSERT OR UPDATE OF company_id, is_active ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_company_user_limit();

CREATE OR REPLACE FUNCTION public.enforce_company_sector_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lim integer; used integer;
BEGIN
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.company_id IS NOT DISTINCT FROM NEW.company_id THEN RETURN NEW; END IF;
  SELECT max_sectors INTO lim FROM public.company_limits(NEW.company_id);
  IF lim IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO used FROM public.sectors WHERE company_id = NEW.company_id AND id <> NEW.id;
  IF used >= lim THEN
    RAISE EXCEPTION 'LIMITE_SETORES: o plano permite % setores. Mude para um plano maior para criar mais.', lim USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_company_sector_limit() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS sectors_limit ON public.sectors;
CREATE TRIGGER sectors_limit BEFORE INSERT OR UPDATE OF company_id ON public.sectors
  FOR EACH ROW EXECUTE FUNCTION public.enforce_company_sector_limit();

-- What the signed-in user's company may use (plan, features, limits and usage).
CREATE OR REPLACE FUNCTION public.get_my_company_plan()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid := public.current_company_id(); r jsonb; lim record;
BEGIN
  IF cid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO lim FROM public.company_limits(cid);
  SELECT jsonb_build_object(
    'company_id', c.id, 'is_system', c.is_system,
    'status', coalesce(s.status, 'pending'), 'plan_id', s.plan_id, 'plan_name', p.name,
    'billing_cycle', coalesce(s.billing_cycle, 'monthly'), 'current_period_end', s.current_period_end,
    'has_auto_renewal', s.provider_subscription_id IS NOT NULL,
    'features', CASE WHEN c.is_system OR s.status = 'exempt' THEN to_jsonb(ARRAY['*']) ELSE to_jsonb(coalesce(p.features, ARRAY[]::text[])) END,
    'price_cents', p.price_cents, 'annual_price_cents', p.annual_price_cents,
    'extra_users', coalesce(s.extra_users, 0), 'extra_storage_gb', coalesce(s.extra_storage_gb, 0), 'free_seats', coalesce(s.free_seats, 0),
    'limits', jsonb_build_object('users', lim.max_users, 'sectors', lim.max_sectors, 'storage_bytes', lim.storage_bytes),
    'usage', jsonb_build_object(
      'users', (SELECT count(*) FROM public.profiles WHERE company_id = cid AND is_active AND coalesce(profile_type, 'user') NOT IN ('system', 'bot')),
      'sectors', (SELECT count(*) FROM public.sectors WHERE company_id = cid),
      'storage_bytes', public.company_storage_used(cid)),
    'prices', (SELECT jsonb_build_object('extra_user_cents', extra_user_cents, 'storage_pack_gb', storage_pack_gb, 'storage_pack_cents', storage_pack_cents) FROM public.billing_settings LIMIT 1)
  ) INTO r
  FROM public.companies c
  LEFT JOIN public.company_subscriptions s ON s.company_id = c.id
  LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
  WHERE c.id = cid;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_my_company_plan() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_company_plan() TO authenticated;

-- History of the payments already confirmed through the website.
INSERT INTO public.company_payments (company_id, provider_payment_id, kind, description, amount_cents, paid_at)
SELECT company_id, last_payment_id, 'signup', 'Assinatura inicial', amount_cents, coalesce(paid_at, activated_at, now())
FROM public.company_signups WHERE status = 'active' AND company_id IS NOT NULL AND last_payment_id IS NOT NULL
ON CONFLICT (provider, provider_payment_id) DO NOTHING;
