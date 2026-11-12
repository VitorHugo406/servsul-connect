-- Company registration data collected at signup (legal name, CNPJ, address) + payment receipts sent by e-mail.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS billing_data jsonb;
ALTER TABLE public.company_signups ADD COLUMN IF NOT EXISTS company_data jsonb;
ALTER TABLE public.signup_email_codes ADD COLUMN IF NOT EXISTS company_data jsonb;

CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq;
ALTER TABLE public.company_payments
  ADD COLUMN IF NOT EXISTS receipt_number bigint,
  ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_attempts int NOT NULL DEFAULT 0;
-- Payments that already exist get a number but are not sent again.
UPDATE public.company_payments SET receipt_number = nextval('public.receipt_number_seq'), receipt_sent_at = now() WHERE receipt_number IS NULL;

-- The signup row carries the company data given when the e-mail was confirmed, and cannot be created without it.
CREATE OR REPLACE FUNCTION public.require_verified_signup_email() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF new.admin_email ILIKE '%@ewvon.invalid' THEN RETURN new; END IF;
  SELECT * INTO c FROM public.signup_email_codes WHERE email = lower(new.admin_email) AND verified_at IS NOT NULL AND verified_at > now() - interval '1 hour';
  IF NOT FOUND THEN RAISE EXCEPTION 'E-mail não confirmado'; END IF;
  IF c.company_data IS NULL THEN RAISE EXCEPTION 'Dados da empresa não informados'; END IF;
  new.company_data := c.company_data;
  RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.require_verified_signup_email() FROM PUBLIC, anon, authenticated;

-- Once the company exists and is active, its registration data moves to the company itself.
CREATE OR REPLACE FUNCTION public.copy_signup_company_data() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.status = 'active' AND new.company_id IS NOT NULL AND new.company_data IS NOT NULL THEN
    UPDATE public.companies SET billing_data = new.company_data WHERE id = new.company_id AND billing_data IS NULL;
  END IF;
  RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.copy_signup_company_data() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS company_signups_copy_data ON public.company_signups;
CREATE TRIGGER company_signups_copy_data AFTER UPDATE OF status ON public.company_signups
  FOR EACH ROW EXECUTE FUNCTION public.copy_signup_company_data();

-- Receipt number for every new payment, and a call to the `receipt` function right after it is recorded.
CREATE OR REPLACE FUNCTION public.company_payments_before_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF new.receipt_number IS NULL THEN new.receipt_number := nextval('public.receipt_number_seq'); END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS company_payments_number ON public.company_payments;
CREATE TRIGGER company_payments_number BEFORE INSERT ON public.company_payments
  FOR EACH ROW EXECUTE FUNCTION public.company_payments_before_insert();

CREATE OR REPLACE FUNCTION public.company_payments_send_receipt() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/receipt',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-billing-cron', s.decrypted_secret),
    body := jsonb_build_object('payment_id', new.id)
  ) FROM vault.decrypted_secrets s WHERE s.name = 'billing_cron_secret';
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'company_payments_send_receipt: %', SQLERRM;
  RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.company_payments_send_receipt() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS company_payments_receipt ON public.company_payments;
CREATE TRIGGER company_payments_receipt AFTER INSERT ON public.company_payments
  FOR EACH ROW EXECUTE FUNCTION public.company_payments_send_receipt();

-- Safety net: every 10 minutes, receipts that were not delivered yet are tried again (up to 5 times).
SELECT cron.unschedule('ewvon-receipt-sweep') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ewvon-receipt-sweep');
SELECT cron.schedule('ewvon-receipt-sweep', '*/10 * * * *', $cron$
  SELECT net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/receipt',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-billing-cron', s.decrypted_secret),
    body := '{"sweep":true}'::jsonb
  ) FROM vault.decrypted_secrets s WHERE s.name = 'billing_cron_secret'
$cron$);
