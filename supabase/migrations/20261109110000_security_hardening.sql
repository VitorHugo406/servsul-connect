-- Security hardening from the 2026-11-09 audit.

-- 1) Private profile data: colleagues of the same company could read CPF, address and
--    registration number of everyone. Only these three columns become private; the person reads
--    them through get_my_full_profile() and admins through admin_list_profiles_full() /
--    get_profiles_registration() (all SECURITY DEFINER with their own checks).
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, user_id, name, display_name, email, avatar_url, cover_url, sector_id, autonomy_level, birth_date,
  created_at, updated_at, phone, profile_type, is_active, last_seen_at, user_status, work_period, company_id,
  description, team_alert_times, team_alerts_enabled, company, work_start, work_end, work_days, status_until)
  ON public.profiles TO authenticated;

-- 2) Trigger functions are not meant to be called through the API.
REVOKE EXECUTE ON FUNCTION public.company_subscription_guard() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.company_subscription_log() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.company_subscription_on_company() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_support_ticket_message() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_chat_media_recipients() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tasks_number_per_board() FROM public, anon, authenticated;

-- 3) Fixed search_path (linter 0011).
ALTER FUNCTION public.system_sender_id() SET search_path = public;

-- 4) Evaluation policies were granted to "public" (includes anon); restrict to signed-in users.
ALTER POLICY "Users can view evaluation items" ON public.evaluation_items TO authenticated;
ALTER POLICY "Evaluators can create evaluations" ON public.evaluations TO authenticated;
ALTER POLICY "Evaluators can update evaluations" ON public.evaluations TO authenticated;
ALTER POLICY "Users can view own evaluations" ON public.evaluations TO authenticated;

-- 5) Monthly feedback PDF (attachments/feedback/<month>/<profile_id>.pdf): only its owner can
--    download it, inside the app. The chat no longer carries a public signed link.
DROP POLICY IF EXISTS "Owner downloads own feedback report" ON storage.objects;
CREATE POLICY "Owner downloads own feedback report" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'feedback'
         AND storage.filename(name) = public.get_current_profile_id()::text || '.pdf');
