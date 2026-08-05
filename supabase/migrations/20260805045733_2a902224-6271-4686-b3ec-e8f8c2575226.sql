-- WAR ROOMS: remove super admin cross-tenant bypass
DROP POLICY IF EXISTS "Members creators and admins can view war rooms" ON public.war_rooms;
CREATE POLICY "Members creators and admins can view war rooms"
ON public.war_rooms FOR SELECT TO authenticated
USING (
  same_company(company_id)
  AND (
    is_admin() OR created_by = auth.uid() OR is_war_room_member(id)
    OR EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = auth.uid() AND (up.can_create_war_room OR up.can_access_management))
  )
);

DROP POLICY IF EXISTS "Users can view war room messages" ON public.war_room_messages;
CREATE POLICY "Users can view war room messages"
ON public.war_room_messages FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM war_rooms wr WHERE wr.id = war_room_messages.war_room_id AND same_company(wr.company_id))
  AND (
    is_war_room_member(war_room_id) OR is_admin() OR has_autonomy_level('supervisor')
    OR EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = auth.uid() AND (up.can_access_management OR up.can_create_war_room))
  )
);

DROP POLICY IF EXISTS "Members creators and admins can view timeline" ON public.war_room_timeline;
CREATE POLICY "Members creators and admins can view timeline"
ON public.war_room_timeline FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM war_rooms wr WHERE wr.id = war_room_timeline.war_room_id AND same_company(wr.company_id))
  AND (
    is_admin() OR created_by = auth.uid() OR is_war_room_member(war_room_id)
    OR EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = auth.uid() AND (up.can_access_management OR up.can_create_war_room))
  )
);

-- EVALUATIONS: company scoping
DROP POLICY IF EXISTS "Users can view own evaluations" ON public.evaluations;
CREATE POLICY "Users can view own evaluations"
ON public.evaluations FOR SELECT TO authenticated
USING (
  same_company(company_id)
  AND (
    evaluator_id = get_current_profile_id() OR evaluated_id = get_current_profile_id()
    OR is_admin() OR has_autonomy_level('supervisor')
  )
);

DROP POLICY IF EXISTS "Evaluators can update evaluations" ON public.evaluations;
CREATE POLICY "Evaluators can update evaluations"
ON public.evaluations FOR UPDATE TO authenticated
USING (
  same_company(company_id)
  AND (
    evaluator_id = get_current_profile_id() OR evaluated_id = get_current_profile_id()
    OR is_admin() OR has_autonomy_level('supervisor')
  )
);

DROP POLICY IF EXISTS "Admins can delete evaluations" ON public.evaluations;
CREATE POLICY "Admins can delete evaluations"
ON public.evaluations FOR DELETE TO authenticated
USING (same_company(company_id) AND is_admin());

DROP POLICY IF EXISTS "Users can view evaluation items" ON public.evaluation_items;
CREATE POLICY "Users can view evaluation items"
ON public.evaluation_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM evaluations e
  WHERE e.id = evaluation_items.evaluation_id
    AND same_company(e.company_id)
    AND (e.evaluator_id = get_current_profile_id() OR e.evaluated_id = get_current_profile_id() OR is_admin() OR has_autonomy_level('supervisor'))
));

DROP POLICY IF EXISTS "Evaluators can manage items" ON public.evaluation_items;
CREATE POLICY "Evaluators can manage items"
ON public.evaluation_items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM evaluations e
  WHERE e.id = evaluation_items.evaluation_id
    AND same_company(e.company_id)
    AND (e.evaluator_id = get_current_profile_id() OR is_admin() OR has_autonomy_level('supervisor'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM evaluations e
  WHERE e.id = evaluation_items.evaluation_id
    AND same_company(e.company_id)
    AND (e.evaluator_id = get_current_profile_id() OR is_admin() OR has_autonomy_level('supervisor'))
));

DROP POLICY IF EXISTS "Evaluated can respond to items" ON public.evaluation_items;
CREATE POLICY "Evaluated can respond to items"
ON public.evaluation_items FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM evaluations e
  WHERE e.id = evaluation_items.evaluation_id AND same_company(e.company_id) AND e.evaluated_id = get_current_profile_id()
));

DROP POLICY IF EXISTS "Users can view evaluation history" ON public.evaluation_history;
CREATE POLICY "Users can view evaluation history"
ON public.evaluation_history FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM evaluations e
  WHERE e.id = evaluation_history.evaluation_id
    AND same_company(e.company_id)
    AND (e.evaluator_id = get_current_profile_id() OR e.evaluated_id = get_current_profile_id() OR is_admin() OR has_autonomy_level('supervisor'))
));

-- Evaluation config tables: scope management to same company too
DROP POLICY IF EXISTS "Supervisors can manage competencies" ON public.eval_competencies;
CREATE POLICY "Supervisors can manage competencies"
ON public.eval_competencies FOR ALL TO authenticated
USING (same_company(company_id) AND (is_admin() OR has_autonomy_level('supervisor')))
WITH CHECK (same_company(company_id) AND (is_admin() OR has_autonomy_level('supervisor')));

DROP POLICY IF EXISTS "Supervisors can manage cycles" ON public.eval_cycles;
CREATE POLICY "Supervisors can manage cycles"
ON public.eval_cycles FOR ALL TO authenticated
USING (same_company(company_id) AND (is_admin() OR has_autonomy_level('supervisor')))
WITH CHECK (same_company(company_id) AND (is_admin() OR has_autonomy_level('supervisor')));

DROP POLICY IF EXISTS "Supervisors can manage positions" ON public.eval_positions;
CREATE POLICY "Supervisors can manage positions"
ON public.eval_positions FOR ALL TO authenticated
USING (same_company(company_id) AND (is_admin() OR has_autonomy_level('supervisor')))
WITH CHECK (same_company(company_id) AND (is_admin() OR has_autonomy_level('supervisor')));