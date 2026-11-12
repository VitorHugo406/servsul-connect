-- Confirmation of the administrator e-mail (6-digit code) before a paid signup can start.
CREATE TABLE IF NOT EXISTS public.signup_email_codes (
  email text PRIMARY KEY,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  sends int NOT NULL DEFAULT 1,
  sends_window_start timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);
ALTER TABLE public.signup_email_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signup_email_codes FROM anon, authenticated;

-- A signup row can only be created for an e-mail confirmed in the last hour (the page also blocks it;
-- this keeps the rule even if the page is bypassed). The automatic self-test uses @ewvon.invalid.
CREATE OR REPLACE FUNCTION public.require_verified_signup_email() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.admin_email ILIKE '%@ewvon.invalid' THEN RETURN new; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.signup_email_codes c
                 WHERE c.email = lower(new.admin_email) AND c.verified_at IS NOT NULL AND c.verified_at > now() - interval '1 hour') THEN
    RAISE EXCEPTION 'E-mail não confirmado';
  END IF;
  RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.require_verified_signup_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS company_signups_require_email ON public.company_signups;
CREATE TRIGGER company_signups_require_email BEFORE INSERT ON public.company_signups
  FOR EACH ROW EXECUTE FUNCTION public.require_verified_signup_email();
