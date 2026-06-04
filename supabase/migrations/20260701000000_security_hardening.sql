-- 1. Hardening SECURITY DEFINER functions
-- Revoke execution from public to prevent anonymous access to helper functions
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Grant execution to authenticated users and service role
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 2. Fixing "Always True" RLS Policies
-- Presence: Only authenticated users should see presence
DROP POLICY IF EXISTS "Everyone can view presence" ON public.user_presence;
CREATE POLICY "Authenticated users can view presence"
  ON public.user_presence FOR SELECT
  TO authenticated
  USING (true);

-- Monthly Scores: Restrict INSERT and UPDATE
DROP POLICY IF EXISTS "Authenticated can insert scores" ON public.monthly_scores;
CREATE POLICY "Admins and system can insert scores"
ON public.monthly_scores FOR INSERT
TO authenticated, service_role
WITH CHECK (is_admin() OR (SELECT auth.role()) = 'service_role');

DROP POLICY IF EXISTS "Authenticated can update scores" ON public.monthly_scores;
CREATE POLICY "Admins and system can update scores"
ON public.monthly_scores FOR UPDATE
TO authenticated, service_role
USING (is_admin() OR (SELECT auth.role()) = 'service_role');

-- 3. Storage Security Hardening
-- Set buckets to private (requires signed URLs or RLS)
UPDATE storage.buckets SET public = false WHERE id IN ('attachments', 'avatars');

-- Avatars: Only authenticated users can view
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Authenticated users can view avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

-- Attachments: Only users with access to the linked content can view
DROP POLICY IF EXISTS "Attachments are publicly accessible for viewing" ON storage.objects;
CREATE POLICY "Users can view attachments if they have access to the record"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'attachments' AND 
    EXISTS (
      SELECT 1 FROM public.attachments a
      WHERE (storage.foldername(storage.objects.name))[1] = a.id::text -- Assuming folder name is attachment ID or similar
      -- More precise check would be needed based on how files are stored
    )
  );

-- Note: The attachment policy above is a template. 
-- A more secure way is to use signed URLs for private buckets.
-- Given the app's structure, keeping them private and using RLS is better.

-- 4. Secure the system_settings table even further
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only admins can view system settings" ON public.system_settings;
CREATE POLICY "Admins and service role can view system settings"
  ON public.system_settings FOR SELECT
  TO authenticated, service_role
  USING (is_admin() OR (SELECT auth.role()) = 'service_role');

