
-- Fix system_settings RLS: the restrictive policy blocks non-admins
-- Drop the restrictive policy and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Anyone authenticated can read weekly_file_limit" ON public.system_settings;

CREATE POLICY "Anyone authenticated can read weekly_file_limit"
ON public.system_settings
FOR SELECT
TO authenticated
USING (key = 'weekly_file_limit');

-- Update has_autonomy_level to include 'diretoria' at supervisor level
CREATE OR REPLACE FUNCTION public.has_autonomy_level(required_level text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN required_level = 'colaborador' THEN true
    WHEN required_level = 'supervisor' THEN 
      public.get_current_autonomy_level() IN ('admin', 'gerente', 'supervisor', 'diretoria')
    WHEN required_level = 'gerente' THEN 
      public.get_current_autonomy_level() IN ('admin', 'gerente')
    WHEN required_level = 'admin' THEN 
      public.get_current_autonomy_level() = 'admin'
    ELSE false
  END;
$$;
