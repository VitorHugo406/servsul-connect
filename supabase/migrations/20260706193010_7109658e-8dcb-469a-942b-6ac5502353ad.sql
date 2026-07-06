-- ============================================================
-- 1. ISOLAMENTO: super_admin NÃO vê dados de conteúdo de outras empresas.
--    same_company() passa a comparar somente company_id do próprio profile.
-- ============================================================
CREATE OR REPLACE FUNCTION public.same_company(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _company_id IS NOT NULL AND _company_id = public.current_company_id()
$$;

-- ============================================================
-- 2. MÓDULOS POR EMPRESA
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS enabled_modules text[] NOT NULL DEFAULT ARRAY[
    'chat','announcements','tasks','calendar','notes','birthdays',
    'evaluations','war_room','teams','my_dashboard',
    'bi','bh','fechamento','orbs'
  ]::text[];

-- Empresa "Admin" (sistema) só precisa dos essenciais para o super-admin operar.
UPDATE public.companies
   SET enabled_modules = ARRAY['companies_admin']::text[]
 WHERE is_system = true;

-- ServSul: todos os módulos ativos (default acima já cobre, garantimos explicitamente).
UPDATE public.companies
   SET enabled_modules = ARRAY[
     'chat','announcements','tasks','calendar','notes','birthdays',
     'evaluations','war_room','teams','my_dashboard',
     'bi','bh','fechamento','orbs'
   ]::text[]
 WHERE slug = 'grupo-servsul';

-- ============================================================
-- 3. RLS de companies: leitura pública da própria + super-admin vê todas (metadados)
-- ============================================================
DROP POLICY IF EXISTS "companies_select" ON public.companies;
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Super admin manages companies" ON public.companies;

CREATE POLICY "companies_select_own_or_superadmin"
  ON public.companies FOR SELECT
  TO authenticated
  USING (
    id = public.current_company_id()
    OR public.is_super_admin()
  );

CREATE POLICY "companies_super_admin_insert"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "companies_super_admin_update"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "companies_super_admin_delete"
  ON public.companies FOR DELETE
  TO authenticated
  USING (public.is_super_admin() AND NOT is_system);

-- ============================================================
-- 4. RPC: estatísticas de empresas (só super_admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_companies_with_stats()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  primary_color text,
  secondary_color text,
  is_active boolean,
  is_system boolean,
  enabled_modules text[],
  total_users integer,
  active_users integer,
  admins integer,
  supervisors integer,
  colaboradores integer,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    c.logo_url,
    c.primary_color,
    c.secondary_color,
    c.is_active,
    c.is_system,
    c.enabled_modules,
    COALESCE(u.total, 0)::int      AS total_users,
    COALESCE(u.active, 0)::int     AS active_users,
    COALESCE(r.admins, 0)::int     AS admins,
    COALESCE(r.supervisors, 0)::int AS supervisors,
    COALESCE(r.colaboradores, 0)::int AS colaboradores,
    c.created_at
  FROM public.companies c
  LEFT JOIN (
    SELECT company_id,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE is_active) AS active
    FROM public.profiles
    GROUP BY company_id
  ) u ON u.company_id = c.id
  LEFT JOIN (
    SELECT p.company_id,
           COUNT(*) FILTER (WHERE ur.role::text IN ('admin','super_admin')) AS admins,
           COUNT(*) FILTER (WHERE p.autonomy_level IN ('supervisor','gerente','diretoria')) AS supervisors,
           COUNT(*) FILTER (WHERE COALESCE(p.autonomy_level,'colaborador') = 'colaborador') AS colaboradores
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
    GROUP BY p.company_id
  ) r ON r.company_id = c.id
  ORDER BY c.is_system DESC, c.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_companies_with_stats() TO authenticated;

-- ============================================================
-- 5. RPC: lista usuários de uma empresa (só super_admin ou admin da própria empresa)
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_company_users(_company_id uuid)
RETURNS TABLE (
  profile_id uuid,
  user_id uuid,
  name text,
  display_name text,
  email text,
  autonomy_level text,
  is_active boolean,
  roles text[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_super_admin()
    OR (public.is_admin() AND _company_id = public.current_company_id())
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.name,
    p.display_name,
    p.email,
    p.autonomy_level,
    p.is_active,
    COALESCE(
      ARRAY(SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.user_id),
      ARRAY[]::text[]
    )
  FROM public.profiles p
  WHERE p.company_id = _company_id
  ORDER BY p.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_company_users(uuid) TO authenticated;

-- ============================================================
-- 6. RPC pública (sem auth): lista empresas ativas p/ tela de seleção de login
--    Retorna somente metadados públicos (nome, slug, logo, cores).
--    Não expõe empresas do sistema.
-- ============================================================
CREATE OR REPLACE FUNCTION public.public_list_companies_for_login()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  primary_color text,
  secondary_color text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, slug, logo_url, primary_color, secondary_color
  FROM public.companies
  WHERE is_active = true AND is_system = false
  ORDER BY name
$$;

GRANT EXECUTE ON FUNCTION public.public_list_companies_for_login() TO anon, authenticated;

-- Também expõe o metadado da empresa Admin/Vetor para o login do super_admin.
CREATE OR REPLACE FUNCTION public.public_get_company_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  primary_color text,
  secondary_color text,
  is_system boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, slug, logo_url, primary_color, secondary_color, is_system
  FROM public.companies
  WHERE slug = _slug AND is_active = true
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.public_get_company_by_slug(text) TO anon, authenticated;
