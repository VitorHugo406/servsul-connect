
-- 1) Fix ambiguous is_active in list_companies_with_stats (RETURNS TABLE column conflicts with p.is_active)
CREATE OR REPLACE FUNCTION public.list_companies_with_stats()
 RETURNS TABLE(id uuid, name text, slug text, logo_url text, primary_color text, secondary_color text, is_active boolean, is_system boolean, enabled_modules text[], total_users integer, active_users integer, admins integer, supervisors integer, colaboradores integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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
    COALESCE(u.total_u, 0)::int      AS total_users,
    COALESCE(u.active_u, 0)::int     AS active_users,
    COALESCE(r.admins_c, 0)::int     AS admins,
    COALESCE(r.sup_c, 0)::int        AS supervisors,
    COALESCE(r.col_c, 0)::int        AS colaboradores,
    c.created_at
  FROM public.companies c
  LEFT JOIN (
    SELECT p.company_id AS cid,
           COUNT(*) AS total_u,
           COUNT(*) FILTER (WHERE p.is_active) AS active_u
    FROM public.profiles p
    GROUP BY p.company_id
  ) u ON u.cid = c.id
  LEFT JOIN (
    SELECT p.company_id AS cid,
           COUNT(*) FILTER (WHERE ur.role::text IN ('admin','super_admin')) AS admins_c,
           COUNT(*) FILTER (WHERE p.autonomy_level IN ('supervisor','gerente','diretoria')) AS sup_c,
           COUNT(*) FILTER (WHERE COALESCE(p.autonomy_level,'colaborador') = 'colaborador') AS col_c
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
    GROUP BY p.company_id
  ) r ON r.cid = c.id
  ORDER BY c.is_system DESC, c.name;
END;
$function$;

-- 2) Exact-only company search
CREATE OR REPLACE FUNCTION public.public_find_company(_query text)
 RETURNS TABLE(id uuid, name text, slug text, logo_url text, primary_color text, secondary_color text, is_system boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id, c.name, c.slug, c.logo_url, c.primary_color, c.secondary_color, c.is_system
  FROM public.companies c
  WHERE c.is_active = true
    AND (
      lower(trim(c.slug)) = lower(trim(coalesce(_query,'')))
      OR lower(trim(c.name)) = lower(trim(coalesce(_query,'')))
    )
  LIMIT 1
$function$;

-- 3) Multi-tenant isolation: rewrite SELECT policies to always enforce same_company()

-- messages
DROP POLICY IF EXISTS "Usuários podem ver mensagens dos setores com acesso" ON public.messages;
CREATE POLICY "Same company members can view sector messages"
ON public.messages FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND same_company(company_id)
  AND (
    sector_id = get_current_sector_id()
    OR sector_id = '00000000-0000-0000-0000-000000000001'::uuid
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_additional_sectors uas
      WHERE uas.user_id = auth.uid() AND uas.sector_id = messages.sector_id
    )
  )
);

-- direct_messages
DROP POLICY IF EXISTS "Users can only view their own direct messages" ON public.direct_messages;
CREATE POLICY "Users can only view their own direct messages"
ON public.direct_messages FOR SELECT
USING (
  same_company(company_id)
  AND (
    sender_id = get_current_profile_id()
    OR receiver_id = get_current_profile_id()
  )
);

-- private_groups
DROP POLICY IF EXISTS "Members can view their groups" ON public.private_groups;
CREATE POLICY "Members can view their groups"
ON public.private_groups FOR SELECT
USING (
  same_company(company_id)
  AND (user_is_member_of_group(id) OR created_by = auth.uid())
);

-- calendar_events
DROP POLICY IF EXISTS "Users can view own or invited calendar events" ON public.calendar_events;
CREATE POLICY "Users can view own or invited calendar events"
ON public.calendar_events FOR SELECT
USING (
  same_company(company_id)
  AND can_view_calendar_event(id, created_by)
);

-- tasks (non-board case)
DROP POLICY IF EXISTS "Users can view tasks in their sectors" ON public.tasks;
CREATE POLICY "Users can view tasks in their sectors"
ON public.tasks FOR SELECT
USING (
  same_company(company_id)
  AND (
    is_admin()
    OR (
      board_id IS NULL
      AND (
        sector_id IS NULL
        OR sector_id = get_current_sector_id()
        OR sector_id = '00000000-0000-0000-0000-000000000001'::uuid
        OR EXISTS (
          SELECT 1 FROM public.user_additional_sectors uas
          WHERE uas.user_id = auth.uid() AND uas.sector_id = tasks.sector_id
        )
      )
    )
  )
);
