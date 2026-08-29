-- Nuvexa: atalhos configuráveis por empresa, usuário e setor.
CREATE TABLE IF NOT EXISTS public.system_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  url TEXT NOT NULL CHECK (url ~* '^https?://'),
  icon TEXT NOT NULL DEFAULT 'Link',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_shortcut_users (
  shortcut_id UUID NOT NULL REFERENCES public.system_shortcuts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (shortcut_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.system_shortcut_sectors (
  shortcut_id UUID NOT NULL REFERENCES public.system_shortcuts(id) ON DELETE CASCADE,
  sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  PRIMARY KEY (shortcut_id, sector_id)
);

CREATE INDEX IF NOT EXISTS idx_system_shortcuts_company ON public.system_shortcuts(company_id);
CREATE INDEX IF NOT EXISTS idx_system_shortcut_users_user ON public.system_shortcut_users(user_id);
CREATE INDEX IF NOT EXISTS idx_system_shortcut_sectors_sector ON public.system_shortcut_sectors(sector_id);

ALTER TABLE public.system_shortcuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_shortcut_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_shortcut_sectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam atalhos" ON public.system_shortcuts;
DROP POLICY IF EXISTS "Usuários veem seus atalhos" ON public.system_shortcuts;
DROP POLICY IF EXISTS "Admins gerenciam usuários dos atalhos" ON public.system_shortcut_users;
DROP POLICY IF EXISTS "Usuários veem vínculos dos seus atalhos" ON public.system_shortcut_users;
DROP POLICY IF EXISTS "Admins gerenciam setores dos atalhos" ON public.system_shortcut_sectors;
DROP POLICY IF EXISTS "Usuários veem vínculos dos seus atalhos por setor" ON public.system_shortcut_sectors;

CREATE POLICY "Admins gerenciam atalhos"
ON public.system_shortcuts FOR ALL TO authenticated
USING (public.has_autonomy_level('admin') AND company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1))
WITH CHECK (public.has_autonomy_level('admin') AND company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Usuários veem seus atalhos"
ON public.system_shortcuts FOR SELECT TO authenticated
USING (
  is_active = true
  AND company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  AND (
    EXISTS (
      SELECT 1 FROM public.system_shortcut_users su
      JOIN public.profiles p ON p.id = su.user_id
      WHERE su.shortcut_id = system_shortcuts.id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.system_shortcut_sectors ss
      JOIN public.profiles p ON p.sector_id = ss.sector_id
      WHERE ss.shortcut_id = system_shortcuts.id AND p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins gerenciam usuários dos atalhos"
ON public.system_shortcut_users FOR ALL TO authenticated
USING (
  public.has_autonomy_level('admin')
  AND EXISTS (
    SELECT 1 FROM public.system_shortcuts s
    WHERE s.id = system_shortcut_users.shortcut_id
      AND s.company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  )
)
WITH CHECK (
  public.has_autonomy_level('admin')
  AND EXISTS (
    SELECT 1 FROM public.system_shortcuts s
    WHERE s.id = system_shortcut_users.shortcut_id
      AND s.company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  )
);

CREATE POLICY "Usuários veem vínculos dos seus atalhos"
ON public.system_shortcut_users FOR SELECT TO authenticated
USING (user_id = public.get_current_profile_id());

CREATE POLICY "Admins gerenciam setores dos atalhos"
ON public.system_shortcut_sectors FOR ALL TO authenticated
USING (
  public.has_autonomy_level('admin')
  AND EXISTS (
    SELECT 1 FROM public.system_shortcuts s
    WHERE s.id = system_shortcut_sectors.shortcut_id
      AND s.company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  )
)
WITH CHECK (
  public.has_autonomy_level('admin')
  AND EXISTS (
    SELECT 1 FROM public.system_shortcuts s
    WHERE s.id = system_shortcut_sectors.shortcut_id
      AND s.company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  )
);

CREATE POLICY "Usuários veem vínculos dos seus atalhos por setor"
ON public.system_shortcut_sectors FOR SELECT TO authenticated
USING (sector_id = public.get_current_sector_id());

DROP TRIGGER IF EXISTS update_system_shortcuts_updated_at ON public.system_shortcuts;
CREATE TRIGGER update_system_shortcuts_updated_at
BEFORE UPDATE ON public.system_shortcuts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
