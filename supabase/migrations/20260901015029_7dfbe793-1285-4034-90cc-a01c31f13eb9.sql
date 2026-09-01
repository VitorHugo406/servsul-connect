CREATE TABLE IF NOT EXISTS public.system_shortcuts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  icon text NOT NULL DEFAULT 'Link',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_shortcut_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut_id uuid NOT NULL REFERENCES public.system_shortcuts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shortcut_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.system_shortcut_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut_id uuid NOT NULL REFERENCES public.system_shortcuts(id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shortcut_id, sector_id)
);

CREATE INDEX IF NOT EXISTS idx_system_shortcuts_company ON public.system_shortcuts(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_system_shortcut_users_shortcut ON public.system_shortcut_users(shortcut_id);
CREATE INDEX IF NOT EXISTS idx_system_shortcut_users_user ON public.system_shortcut_users(user_id);
CREATE INDEX IF NOT EXISTS idx_system_shortcut_sectors_shortcut ON public.system_shortcut_sectors(shortcut_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_shortcuts TO authenticated;
GRANT ALL ON public.system_shortcuts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_shortcut_users TO authenticated;
GRANT ALL ON public.system_shortcut_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_shortcut_sectors TO authenticated;
GRANT ALL ON public.system_shortcut_sectors TO service_role;

ALTER TABLE public.system_shortcuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_shortcut_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_shortcut_sectors ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_shortcut(_shortcut_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_shortcuts s
    WHERE s.id = _shortcut_id
      AND public.same_company(s.company_id)
      AND (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.system_shortcut_users u WHERE u.shortcut_id = s.id AND u.user_id = public.get_current_profile_id())
        OR EXISTS (SELECT 1 FROM public.system_shortcut_sectors sc WHERE sc.shortcut_id = s.id AND public.user_has_sector_access(auth.uid(), sc.sector_id))
      )
  );
$$;

CREATE POLICY "shortcuts_select_allowed" ON public.system_shortcuts
FOR SELECT TO authenticated
USING (public.can_view_shortcut(id));

CREATE POLICY "shortcuts_admin_manage" ON public.system_shortcuts
FOR ALL TO authenticated
USING (public.is_admin() AND public.same_company(company_id))
WITH CHECK (public.is_admin() AND public.same_company(company_id));

CREATE POLICY "shortcut_users_select" ON public.system_shortcut_users
FOR SELECT TO authenticated
USING (public.can_view_shortcut(shortcut_id));

CREATE POLICY "shortcut_users_admin_manage" ON public.system_shortcut_users
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.system_shortcuts s WHERE s.id = shortcut_id AND public.is_admin() AND public.same_company(s.company_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.system_shortcuts s WHERE s.id = shortcut_id AND public.is_admin() AND public.same_company(s.company_id)));

CREATE POLICY "shortcut_sectors_select" ON public.system_shortcut_sectors
FOR SELECT TO authenticated
USING (public.can_view_shortcut(shortcut_id));

CREATE POLICY "shortcut_sectors_admin_manage" ON public.system_shortcut_sectors
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.system_shortcuts s WHERE s.id = shortcut_id AND public.is_admin() AND public.same_company(s.company_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.system_shortcuts s WHERE s.id = shortcut_id AND public.is_admin() AND public.same_company(s.company_id)));

CREATE TRIGGER update_system_shortcuts_updated_at
BEFORE UPDATE ON public.system_shortcuts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.api_integrations
  ADD COLUMN IF NOT EXISTS scope_all_companies boolean NOT NULL DEFAULT false;