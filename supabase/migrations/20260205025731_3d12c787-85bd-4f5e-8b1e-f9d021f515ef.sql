-- Allow admins to update any profile (for activating/deactivating users)
CREATE POLICY "Admins can update any profile" ON profiles
  FOR UPDATE USING (is_admin())
  WITH CHECK (is_admin());