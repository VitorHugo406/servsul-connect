-- Lets the billing function call the company-export function with the same Vault secret the cron uses (server side only).
CREATE OR REPLACE FUNCTION public.billing_cron_secret_value() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'billing_cron_secret' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.billing_cron_secret_value() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_cron_secret_value() TO service_role;
