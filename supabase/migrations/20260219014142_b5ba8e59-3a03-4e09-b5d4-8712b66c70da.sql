
-- Fix RLS for system_settings: non-admins need to read weekly_file_limit
-- The problem: ALL 3 existing policies are RESTRICTIVE, so ALL must pass.
-- The RESTRICTIVE ALL policy with is_admin() blocks non-admins from everything.

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone authenticated can read weekly_file_limit" ON public.system_settings;
DROP POLICY IF EXISTS "Only admins can manage system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Only admins can view system settings" ON public.system_settings;

-- Create PERMISSIVE policies (default behavior: any passing policy grants access)
CREATE POLICY "Admins can manage system settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Authenticated users can read weekly_file_limit"
ON public.system_settings
FOR SELECT
TO authenticated
USING (key = 'weekly_file_limit');
