-- Billing cycles: monthly (recurring), annual (recurring every 12 months, 2 months free by default) and
-- once (one month paid once by Pix, boleto or card through Checkout Pro, no automatic renewal).
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS annual_price_cents integer CHECK (annual_price_cents IS NULL OR annual_price_cents > 0);
UPDATE public.subscription_plans SET annual_price_cents = price_cents * 10 WHERE id IN ('essencial', 'profissional', 'empresarial') AND annual_price_cents IS NULL;
UPDATE public.subscription_plans SET price_cents = 100, annual_price_cents = 100, is_active = true WHERE id = 'teste';

ALTER TABLE public.company_signups ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual', 'once'));
ALTER TABLE public.company_signups ADD COLUMN IF NOT EXISTS mp_preference_id text;
GRANT SELECT (billing_cycle, mp_preference_id) ON public.company_signups TO authenticated;

ALTER TABLE public.company_subscriptions ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual', 'once'));
