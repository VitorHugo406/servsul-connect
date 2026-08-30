-- Profile photos and covers are rendered through normal image URLs throughout the app.
-- The security hardening migration made the avatars bucket private, which breaks
-- getPublicUrl() based avatars/covers and makes new uploads appear to succeed but
-- remain inaccessible. Keep writes authenticated, while allowing authenticated
-- users to read profile media through the public object endpoint.

UPDATE storage.buckets
SET public = true
WHERE id = 'avatars';

DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload profile media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update profile media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete profile media" ON storage.objects;

CREATE POLICY "Authenticated users can view profile media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload profile media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update profile media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete profile media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
