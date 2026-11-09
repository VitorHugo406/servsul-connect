-- Payment reconciliation every 5 minutes (only open signups are checked), so a paid company is created
-- quickly even when a Mercado Pago notification is missing. The internal R$ test plan stays inactive.
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'ewvon-billing-reconcile'), schedule := '*/5 * * * *');
UPDATE public.subscription_plans SET is_active = false WHERE id = 'teste';
