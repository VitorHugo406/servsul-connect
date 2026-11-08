-- Subscriptions groundwork (no payment provider yet).
-- * subscription_plans: the plans shown on the landing page (price, limits, features).
-- * company_subscriptions: one row per company: plan, status, free seats ("acessos gratuitos"),
--   trial/period dates and the provider ids a payment integration will fill in later.
-- * subscription_events: audit/webhook log for the future payment integration.
-- Only the super admin (system Admin company) configures plans and companies. The system Admin
-- company is always exempt ("isenta") and never pays.
-- Nothing is blocked yet: company_has_feature()/company_seat_limit() are ready for the screens
-- to use once billing goes live.

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  billing_interval text NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
  max_users integer NOT NULL CHECK (max_users > 0),
  max_sectors integer NOT NULL CHECK (max_sectors > 0),
  storage_gb integer NOT NULL CHECK (storage_gb > 0),
  features text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Same plans and feature table as public/ewvon-landing.html ("Compare as funcionalidades").
INSERT INTO public.subscription_plans (id, name, description, price_cents, max_users, max_sectors, storage_gb, features, sort_order) VALUES
  ('essencial', 'Essencial', 'Para equipes que querem organizar a rotina.', 8900, 10, 3, 2,
    ARRAY['home','chat','announcements','important_notices','tasks','notes','themes'], 1),
  ('profissional', 'Profissional', 'Para operações que precisam de mais controle.', 21900, 30, 7, 10,
    ARRAY['home','chat','announcements','important_notices','tasks','notes','themes','birthdays','calendar','meeting_rooms','shortcuts','metrics_dashboard'], 2),
  ('empresarial', 'Empresarial', 'Para empresas com operações e equipes maiores.', 59900, 100, 15, 30,
    ARRAY['home','chat','announcements','important_notices','tasks','notes','themes','evaluations','birthdays','calendar','meeting_rooms','shortcuts','metrics_dashboard','people_management','war_room','dashboard_3d'], 3)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id text REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'trialing', 'active', 'past_due', 'canceled', 'free', 'exempt')),
  free_seats integer NOT NULL DEFAULT 0 CHECK (free_seats >= 0),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exempt_has_no_provider CHECK (status <> 'exempt' OR provider_subscription_id IS NULL)
);

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id bigserial PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_events_company_idx ON public.subscription_events (company_id, created_at DESC);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Plans are public pricing: any signed-in person may read; only the super admin edits.
DROP POLICY IF EXISTS "Plans readable" ON public.subscription_plans;
CREATE POLICY "Plans readable" ON public.subscription_plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Super admin manages plans" ON public.subscription_plans;
CREATE POLICY "Super admin manages plans" ON public.subscription_plans FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- A company sees its own subscription; only the super admin creates or changes them.
DROP POLICY IF EXISTS "Company reads own subscription" ON public.company_subscriptions;
CREATE POLICY "Company reads own subscription" ON public.company_subscriptions FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR public.is_super_admin());
DROP POLICY IF EXISTS "Super admin manages subscriptions" ON public.company_subscriptions;
CREATE POLICY "Super admin manages subscriptions" ON public.company_subscriptions FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin reads subscription events" ON public.subscription_events;
CREATE POLICY "Super admin reads subscription events" ON public.subscription_events FOR SELECT TO authenticated
  USING (public.is_super_admin());
DROP POLICY IF EXISTS "Super admin writes subscription events" ON public.subscription_events;
CREATE POLICY "Super admin writes subscription events" ON public.subscription_events FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- The system (Admin) company is always exempt, whatever anyone tries to save.
CREATE OR REPLACE FUNCTION public.company_subscription_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.companies WHERE id = NEW.company_id AND is_system) THEN
    NEW.status := 'exempt'; NEW.plan_id := NULL; NEW.provider := NULL; NEW.provider_customer_id := NULL; NEW.provider_subscription_id := NULL;
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := coalesce(public.get_current_profile_id(), NEW.updated_by);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS company_subscription_guard ON public.company_subscriptions;
CREATE TRIGGER company_subscription_guard BEFORE INSERT OR UPDATE ON public.company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.company_subscription_guard();

-- Log every change (plan, status, free seats) for later reconciliation with the payment provider.
CREATE OR REPLACE FUNCTION public.company_subscription_log() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscription_events (company_id, kind, payload, created_by)
  VALUES (NEW.company_id, CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
    jsonb_build_object('plan_id', NEW.plan_id, 'status', NEW.status, 'free_seats', NEW.free_seats,
      'trial_ends_at', NEW.trial_ends_at, 'old_plan_id', CASE WHEN TG_OP = 'UPDATE' THEN OLD.plan_id END,
      'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END), NEW.updated_by);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS company_subscription_log ON public.company_subscriptions;
CREATE TRIGGER company_subscription_log AFTER INSERT OR UPDATE ON public.company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.company_subscription_log();

-- Every new company gets a row ("pending": the super admin picks plan and free seats).
CREATE OR REPLACE FUNCTION public.company_subscription_on_company() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.company_subscriptions (company_id, status) VALUES (NEW.id, CASE WHEN NEW.is_system THEN 'exempt' ELSE 'pending' END)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS company_subscription_on_company ON public.companies;
CREATE TRIGGER company_subscription_on_company AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.company_subscription_on_company();

-- Existing companies: the system one is exempt; the others keep everything they use today
-- (Empresarial, no charge) until the super admin sets their plan.
INSERT INTO public.company_subscriptions (company_id, plan_id, status, notes)
SELECT c.id, CASE WHEN c.is_system THEN NULL ELSE 'empresarial' END, CASE WHEN c.is_system THEN 'exempt' ELSE 'free' END,
  CASE WHEN c.is_system THEN 'Empresa do sistema: isenta de cobrança.' ELSE 'Empresa existente antes das assinaturas: mantida sem cobrança até definir o plano.' END
FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;

-- Helpers for the screens (not enforced anywhere yet).
CREATE OR REPLACE FUNCTION public.company_has_feature(_company_id uuid, _feature text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT (_company_id = public.current_company_id() OR public.is_super_admin()) THEN false
    WHEN EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND is_system) THEN true
    ELSE coalesce((
      SELECT s.status IN ('exempt') OR (s.status IN ('trialing', 'active', 'free', 'past_due') AND _feature = ANY (p.features))
      FROM public.company_subscriptions s LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
      WHERE s.company_id = _company_id), false)
  END
$$;

-- Users allowed = plan users + free seats granted by the super admin (NULL = unlimited, for exempt).
CREATE OR REPLACE FUNCTION public.company_seat_limit(_company_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT (_company_id = public.current_company_id() OR public.is_super_admin()) THEN 0
    WHEN EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND is_system) THEN NULL
    ELSE (SELECT CASE WHEN s.status = 'exempt' THEN NULL ELSE coalesce(p.max_users, 0) + s.free_seats END
          FROM public.company_subscriptions s LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
          WHERE s.company_id = _company_id)
  END
$$;
REVOKE ALL ON FUNCTION public.company_has_feature(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.company_seat_limit(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.company_has_feature(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_seat_limit(uuid) TO authenticated;
