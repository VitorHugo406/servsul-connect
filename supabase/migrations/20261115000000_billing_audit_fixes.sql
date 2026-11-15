-- Billing audit: lets the signup flow know if the login e-mail already exists in the authentication service
-- (a leftover account there would make the company creation fail AFTER the customer has paid).
CREATE OR REPLACE FUNCTION public.auth_email_exists(_email text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, auth STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(_email));
$$;
REVOKE ALL ON FUNCTION public.auth_email_exists(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_email_exists(text) TO service_role;
