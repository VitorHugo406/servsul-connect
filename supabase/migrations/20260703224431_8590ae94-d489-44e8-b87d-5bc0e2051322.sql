
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#0066CC',
  secondary_color text NOT NULL DEFAULT '#FF6B00',
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.companies (id, name, slug, primary_color, secondary_color, is_system)
VALUES
  ('00000000-0000-0000-0000-0000000000a1','Admin','admin','#111827','#F59E0B',true),
  ('00000000-0000-0000-0000-0000000000a2','Grupo ServSul','servsul','#0066CC','#FF6B00',false)
ON CONFLICT (id) DO NOTHING;

-- Add company_id to all relevant tables FIRST (so functions can reference it)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles','sectors','task_boards','tasks','announcements','important_announcements',
    'messages','direct_messages','private_groups','notes','calendar_events','war_rooms',
    'evaluations','teams','api_integrations','scheduled_summaries','eval_cycles','eval_positions',
    'eval_competencies'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id)', t);
    EXECUTE format('UPDATE public.%I SET company_id = ''00000000-0000-0000-0000-0000000000a2'' WHERE company_id IS NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET DEFAULT ''00000000-0000-0000-0000-0000000000a2''', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_company_id ON public.%I(company_id)', t, t);
  END LOOP;
END $$;

-- Now safe to create functions that reference profiles.company_id
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.same_company(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR _company_id = public.current_company_id()
$$;

DROP POLICY IF EXISTS "Authenticated see own company" ON public.companies;
CREATE POLICY "Authenticated see own company"
  ON public.companies FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = public.current_company_id());

DROP POLICY IF EXISTS "Super admin manages companies" ON public.companies;
CREATE POLICY "Super admin manages companies"
  ON public.companies FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, display_name, email, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'company_id','')::uuid,
      '00000000-0000-0000-0000-0000000000a2'::uuid
    )
  );
  RETURN NEW;
END;
$$;
