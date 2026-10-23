-- Ensure autonomy checks fail closed for unauthenticated/inactive profiles.
CREATE OR REPLACE FUNCTION public.has_autonomy_level(required_level text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.get_current_profile_id() IS NOT NULL
    AND CASE
      WHEN required_level = 'colaborador' THEN true
      WHEN required_level = 'supervisor' THEN
        public.get_current_autonomy_level() IN ('admin', 'gerente', 'supervisor', 'diretoria')
      WHEN required_level = 'gerente' THEN
        public.get_current_autonomy_level() IN ('admin', 'gerente')
      WHEN required_level = 'admin' THEN
        public.get_current_autonomy_level() = 'admin'
      ELSE false
    END;
$function$;

-- A permissive duplicate policy let members insert workflow rules with cross-board
-- column references, bypassing the stricter validation policy.
DROP POLICY IF EXISTS "Board members can insert workflow rules" ON public.column_workflow_rules;
