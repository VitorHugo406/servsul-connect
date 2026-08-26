-- Garante que as logos possam ser exibidas antes do login.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-logos', 'company-logos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read company logos" ON storage.objects;
CREATE POLICY "Public read company logos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'company-logos');
