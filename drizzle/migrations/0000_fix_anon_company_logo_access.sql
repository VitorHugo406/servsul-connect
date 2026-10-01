ALTER POLICY "Admins can manage all face images" ON storage.objects TO authenticated;
ALTER POLICY "Users can delete their own avatar" ON storage.objects TO authenticated;
ALTER POLICY "Users can update their own avatar" ON storage.objects TO authenticated;
ALTER POLICY "Users can upload their own avatar" ON storage.objects TO authenticated;
ALTER POLICY "Users can view permitted attachment files" ON storage.objects TO authenticated;
ALTER POLICY "Users can view their own face images" ON storage.objects TO authenticated;