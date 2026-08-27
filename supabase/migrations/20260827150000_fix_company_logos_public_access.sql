-- Fix company logos visibility for all application surfaces.
-- Company logos are tenant branding assets and must be readable by the
-- company-selection screen (before login) and by authenticated users after login.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Keep exactly one public read policy for the bucket. This avoids the
-- previous migration conflict where authenticated users could lose access
-- after the pre-login policy was recreated for anon only.
DROP POLICY IF EXISTS "Public read company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read company logos" ON storage.objects;
DROP POLICY IF EXISTS "Company logos public read" ON storage.objects;

CREATE POLICY "Company logos public read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'company-logos');

-- Upload/update/delete remain restricted by the existing storage policies.
-- This migration changes read access only; it does not expose write access.
