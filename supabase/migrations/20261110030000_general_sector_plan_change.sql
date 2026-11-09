-- 1. "Geral" sector: every company gets one at creation, with all its employees, and it never counts
--    toward the plan's sector limit.
-- 2. Plan change from the Pagamentos tab: billing_orders.kind 'plan_change' with target_plan_id, and a
--    check that the company's usage fits the new plan.

ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS is_general boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS sectors_one_general_per_company ON public.sectors (company_id) WHERE is_general;

-- Sector limit ignores the general sector.
CREATE OR REPLACE FUNCTION public.enforce_company_sector_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lim integer; used integer;
BEGIN
  IF NEW.company_id IS NULL OR NEW.is_general THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.company_id IS NOT DISTINCT FROM NEW.company_id THEN RETURN NEW; END IF;
  SELECT max_sectors INTO lim FROM public.company_limits(NEW.company_id);
  IF lim IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO used FROM public.sectors WHERE company_id = NEW.company_id AND NOT is_general AND id <> NEW.id;
  IF used >= lim THEN
    RAISE EXCEPTION 'LIMITE_SETORES: o plano permite % setores (fora o setor Geral). Mude para um plano maior para criar mais.', lim USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

-- New company -> its general sector.
CREATE OR REPLACE FUNCTION public.create_company_general_sector()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT NEW.is_system THEN
    INSERT INTO public.sectors (name, color, icon, company_id, is_general)
    VALUES ('Geral', '#64748b', 'users', NEW.id, true)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_company_general_sector() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS companies_general_sector ON public.companies;
CREATE TRIGGER companies_general_sector AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.create_company_general_sector();

-- People without a sector start in the general one.
CREATE OR REPLACE FUNCTION public.profile_default_general_sector()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NOT NULL AND (NEW.sector_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.sectors WHERE id = NEW.sector_id AND company_id = NEW.company_id)) THEN
    NEW.sector_id := coalesce((SELECT id FROM public.sectors WHERE company_id = NEW.company_id AND is_general), NEW.sector_id);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.profile_default_general_sector() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_general_sector_default ON public.profiles;
CREATE TRIGGER profiles_general_sector_default BEFORE INSERT OR UPDATE OF company_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profile_default_general_sector();

-- Everyone in the company is also a member of the general sector (left when changing company).
CREATE OR REPLACE FUNCTION public.profile_join_general_sector()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gid uuid;
BEGIN
  DELETE FROM public.user_additional_sectors uas USING public.sectors s
   WHERE uas.user_id = NEW.user_id AND s.id = uas.sector_id AND s.is_general AND s.company_id IS DISTINCT FROM NEW.company_id;
  SELECT id INTO gid FROM public.sectors WHERE company_id = NEW.company_id AND is_general;
  IF gid IS NOT NULL AND NEW.sector_id IS DISTINCT FROM gid THEN
    INSERT INTO public.user_additional_sectors (user_id, sector_id) VALUES (NEW.user_id, gid) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.profile_join_general_sector() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_general_sector_join ON public.profiles;
CREATE TRIGGER profiles_general_sector_join AFTER INSERT OR UPDATE OF company_id, sector_id ON public.profiles
  FOR EACH ROW WHEN (NEW.user_id IS NOT NULL) EXECUTE FUNCTION public.profile_join_general_sector();

-- Existing client companies: create the sector and add everyone.
INSERT INTO public.sectors (name, color, icon, company_id, is_general)
SELECT 'Geral', '#64748b', 'users', c.id, true FROM public.companies c
WHERE NOT c.is_system AND NOT EXISTS (SELECT 1 FROM public.sectors s WHERE s.company_id = c.id AND s.is_general);
UPDATE public.profiles p SET sector_id = s.id FROM public.sectors s
 WHERE s.company_id = p.company_id AND s.is_general AND p.sector_id IS NULL;
INSERT INTO public.user_additional_sectors (user_id, sector_id)
SELECT p.user_id, s.id FROM public.profiles p JOIN public.sectors s ON s.company_id = p.company_id AND s.is_general
WHERE p.user_id IS NOT NULL AND p.sector_id IS DISTINCT FROM s.id
ON CONFLICT DO NOTHING;

-- Plan usage counts sectors without the general one.
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
      'sectors', (SELECT count(*) FROM public.sectors WHERE company_id = cid AND NOT is_general),
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

-- Plan change orders.
ALTER TABLE public.billing_orders ADD COLUMN IF NOT EXISTS target_plan_id text REFERENCES public.subscription_plans(id);
ALTER TABLE public.billing_orders DROP CONSTRAINT IF EXISTS billing_orders_kind_check;
ALTER TABLE public.billing_orders ADD CONSTRAINT billing_orders_kind_check CHECK (kind IN ('extra_users', 'extra_storage', 'once_renewal', 'plan_change'));
ALTER TABLE public.company_payments DROP CONSTRAINT IF EXISTS company_payments_kind_check;
ALTER TABLE public.company_payments ADD CONSTRAINT company_payments_kind_check CHECK (kind IN ('signup', 'renewal', 'extra_users', 'extra_storage', 'once_renewal', 'plan_change'));

-- Why the company cannot move to a plan (usage above its limits), or NULL when it fits.
CREATE OR REPLACE FUNCTION public.plan_change_blocker(_company_id uuid, _plan_id text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; s record; users_used integer; sectors_used integer; storage_used bigint;
BEGIN
  SELECT * INTO p FROM public.subscription_plans WHERE id = _plan_id;
  IF p.id IS NULL THEN RETURN 'Plano inválido.'; END IF;
  SELECT * INTO s FROM public.company_subscriptions WHERE company_id = _company_id;
  SELECT count(*) INTO users_used FROM public.profiles WHERE company_id = _company_id AND is_active AND coalesce(profile_type, 'user') NOT IN ('system', 'bot');
  SELECT count(*) INTO sectors_used FROM public.sectors WHERE company_id = _company_id AND NOT is_general;
  storage_used := public.company_storage_used(_company_id);
  IF users_used > p.max_users + coalesce(s.free_seats, 0) + coalesce(s.extra_users, 0) THEN
    RETURN format('O plano %s permite %s usuários ativos e a empresa tem %s. Desative usuários antes de mudar.', p.name, p.max_users + coalesce(s.free_seats, 0) + coalesce(s.extra_users, 0), users_used);
  END IF;
  IF sectors_used > p.max_sectors THEN
    RETURN format('O plano %s permite %s setores e a empresa tem %s. Exclua setores antes de mudar.', p.name, p.max_sectors, sectors_used);
  END IF;
  IF storage_used > (p.storage_gb + coalesce(s.extra_storage_gb, 0))::bigint * 1024 * 1024 * 1024 THEN
    RETURN format('O plano %s permite %s GB e a empresa usa mais que isso. Libere espaço antes de mudar.', p.name, p.storage_gb + coalesce(s.extra_storage_gb, 0));
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.plan_change_blocker(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plan_change_blocker(uuid, text) TO service_role;
