-- Facial recognition removed from ewvon (no biometric data is collected). The table was empty.
DROP TABLE IF EXISTS public.user_facial_data CASCADE;
DROP POLICY IF EXISTS "Users can upload their own face images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own face images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all face images" ON storage.objects;
