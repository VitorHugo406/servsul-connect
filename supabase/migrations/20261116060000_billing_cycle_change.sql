-- Mudar a forma de cobrança pela aba Pagamentos (avulso -> mensal/anual automático, mensal <-> anual).
-- Pedido 'cycle_change' em billing_orders, com o ciclo escolhido e o plano de assinatura criado no Mercado Pago.
ALTER TABLE public.billing_orders DROP CONSTRAINT IF EXISTS billing_orders_kind_check;
ALTER TABLE public.billing_orders ADD CONSTRAINT billing_orders_kind_check CHECK (kind IN ('extra_users', 'extra_storage', 'once_renewal', 'plan_change', 'regularize', 'cycle_change'));
ALTER TABLE public.billing_orders ADD COLUMN IF NOT EXISTS target_cycle text;
ALTER TABLE public.billing_orders DROP CONSTRAINT IF EXISTS billing_orders_target_cycle_check;
ALTER TABLE public.billing_orders ADD CONSTRAINT billing_orders_target_cycle_check CHECK (target_cycle IS NULL OR target_cycle IN ('monthly', 'annual'));
ALTER TABLE public.billing_orders ADD COLUMN IF NOT EXISTS mp_plan_id text;
CREATE INDEX IF NOT EXISTS billing_orders_mp_plan ON public.billing_orders (mp_plan_id) WHERE mp_plan_id IS NOT NULL;

-- Confirmação de reserva (caso a pessoa não volte do Mercado Pago): a cada 10 minutos.
SELECT cron.unschedule('ewvon-billing-cycle-sweep') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ewvon-billing-cycle-sweep');
SELECT cron.schedule('ewvon-billing-cycle-sweep', '*/10 * * * *', $$
  SELECT net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/billing-cycle',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-billing-cron', s.decrypted_secret),
    body := '{"action":"sweep"}'::jsonb
  ) FROM vault.decrypted_secrets s WHERE s.name = 'billing_cron_secret'
$$);
