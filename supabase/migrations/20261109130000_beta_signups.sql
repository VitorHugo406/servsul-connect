-- Sign-ups for the free test program (public page /teste-gratuito.html, open until 15/12/2026).
-- Written only by the beta-signup edge function (service role); nobody reads it through the API.
CREATE TABLE IF NOT EXISTS public.beta_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  nome text NOT NULL,
  telefone text NOT NULL,
  empresa text NOT NULL,
  cargo text,
  equipe text,
  funcoes text[] NOT NULL DEFAULT '{}',
  uso text,
  novidades boolean NOT NULL DEFAULT false,
  termos_versao text,
  aceito_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.beta_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beta_signups FROM anon, authenticated;
