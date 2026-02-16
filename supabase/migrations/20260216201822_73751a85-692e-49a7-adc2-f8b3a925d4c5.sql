-- Allow all authenticated users to read the weekly_file_limit setting
CREATE POLICY "Authenticated users can read weekly_file_limit"
ON public.system_settings
FOR SELECT
USING (auth.uid() IS NOT NULL AND key = 'weekly_file_limit');
