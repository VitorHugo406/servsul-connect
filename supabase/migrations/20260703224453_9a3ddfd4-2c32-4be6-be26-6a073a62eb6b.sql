
DROP POLICY IF EXISTS "Auth read company logos" ON storage.objects;
CREATE POLICY "Auth read company logos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "Super admin writes company logos" ON storage.objects;
CREATE POLICY "Super admin writes company logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND public.is_super_admin());

DROP POLICY IF EXISTS "Super admin updates company logos" ON storage.objects;
CREATE POLICY "Super admin updates company logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos' AND public.is_super_admin());

DROP POLICY IF EXISTS "Super admin deletes company logos" ON storage.objects;
CREATE POLICY "Super admin deletes company logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-logos' AND public.is_super_admin());
