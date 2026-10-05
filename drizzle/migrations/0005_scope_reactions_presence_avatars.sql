DROP POLICY IF EXISTS "Authenticated can view reactions" ON public.message_reactions;
CREATE POLICY "Company members can view reactions" ON public.message_reactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = message_reactions.profile_id AND public.same_company(p.company_id)));
DROP POLICY IF EXISTS "Authenticated users can view presence" ON public.user_presence;
CREATE POLICY "Company members can view presence" ON public.user_presence FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = user_presence.user_id AND public.same_company(p.company_id)));
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
CREATE POLICY "Users can view own avatar objects" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);