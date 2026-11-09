-- Each signup gets its own Mercado Pago subscription plan (preapproval_plan), so any Mercado Pago
-- account can pay; the subscription is matched back to the signup by this plan id.
ALTER TABLE public.company_signups ADD COLUMN IF NOT EXISTS mp_plan_id text UNIQUE;
GRANT SELECT (mp_plan_id) ON public.company_signups TO authenticated;
