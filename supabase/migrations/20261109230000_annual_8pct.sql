-- Annual price = 12 months with 8% off, for every public plan.
UPDATE public.subscription_plans SET annual_price_cents = round(price_cents * 12 * 0.92)::int WHERE id IN ('essencial', 'profissional', 'empresarial');
