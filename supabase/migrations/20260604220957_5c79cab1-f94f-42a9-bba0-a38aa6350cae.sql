
-- Reabrir user_notifications para permitir menções e convocações entre usuários
DROP POLICY IF EXISTS "Users create notifications for self or admins for anyone" ON public.user_notifications;
CREATE POLICY "Authenticated users can create notifications"
ON public.user_notifications
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Permitir membros do quadro escreverem scores do quadro
DROP POLICY IF EXISTS "Users insert own monthly scores" ON public.monthly_scores;
DROP POLICY IF EXISTS "Users update own monthly scores" ON public.monthly_scores;

CREATE POLICY "Board members or self insert monthly scores"
ON public.monthly_scores
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR profile_id = public.get_current_profile_id()
  OR (board_id IS NOT NULL AND public.is_board_member(board_id))
);

CREATE POLICY "Board members or self update monthly scores"
ON public.monthly_scores
FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR profile_id = public.get_current_profile_id()
  OR (board_id IS NOT NULL AND public.is_board_member(board_id))
)
WITH CHECK (
  public.is_admin()
  OR profile_id = public.get_current_profile_id()
  OR (board_id IS NOT NULL AND public.is_board_member(board_id))
);
