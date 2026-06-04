
-- 1. api_access_logs: only service_role can insert (edge functions bypass RLS)
DROP POLICY IF EXISTS "System can insert api logs" ON public.api_access_logs;

-- 2. audit_logs: only service_role/triggers can insert
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- 3. evaluation_history: only legitimate participants of the evaluation
DROP POLICY IF EXISTS "System can insert evaluation history" ON public.evaluation_history;
CREATE POLICY "Participants can insert evaluation history"
ON public.evaluation_history
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.evaluations e
    WHERE e.id = evaluation_history.evaluation_id
      AND (
        e.evaluator_id = public.get_current_profile_id()
        OR e.evaluated_id = public.get_current_profile_id()
        OR public.is_admin()
        OR public.has_autonomy_level('supervisor')
      )
  )
  AND performed_by = public.get_current_profile_id()
);

-- 4. monthly_scores: restrict writes to own profile or admin (service role bypasses RLS)
DROP POLICY IF EXISTS "Authenticated can insert scores" ON public.monthly_scores;
DROP POLICY IF EXISTS "Authenticated can update scores" ON public.monthly_scores;
CREATE POLICY "Users insert own monthly scores"
ON public.monthly_scores
FOR INSERT TO authenticated
WITH CHECK (profile_id = public.get_current_profile_id() OR public.is_admin());
CREATE POLICY "Users update own monthly scores"
ON public.monthly_scores
FOR UPDATE TO authenticated
USING (profile_id = public.get_current_profile_id() OR public.is_admin())
WITH CHECK (profile_id = public.get_current_profile_id() OR public.is_admin());

-- 5. task_comments: SELECT only for board members
DROP POLICY IF EXISTS "Users can view task comments" ON public.task_comments;
CREATE POLICY "Board members can view task comments"
ON public.task_comments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id
      AND public.is_board_member(t.board_id)
  )
);

-- 6. user_notifications: must target self OR be admin
DROP POLICY IF EXISTS "Authenticated users can create mention notifications" ON public.user_notifications;
CREATE POLICY "Users create notifications for self or admins for anyone"
ON public.user_notifications
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- 7. task_activities: only board members can log activities for their tasks
DROP POLICY IF EXISTS "Authenticated can insert task activities" ON public.task_activities;
CREATE POLICY "Board members can insert task activities"
ON public.task_activities
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_activities.task_id
      AND public.is_board_member(t.board_id)
  )
);

-- 8. workload_alerts: restrict insert to admin/supervisor (edge fns use service role)
DROP POLICY IF EXISTS "Authenticated can insert workload alerts" ON public.workload_alerts;
DROP POLICY IF EXISTS "System can insert workload alerts" ON public.workload_alerts;
CREATE POLICY "Admins and supervisors insert workload alerts"
ON public.workload_alerts
FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.has_autonomy_level('supervisor'));

-- 9. face-images storage: only admins can upload
DROP POLICY IF EXISTS "Users can upload their own face images" ON storage.objects;
CREATE POLICY "Only admins can upload face images"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'face-images' AND public.is_admin());
