-- Allow board owners and admins to update member roles
CREATE POLICY "Board owners and admins can update members"
ON public.task_board_members
FOR UPDATE
USING (
  is_board_owner(board_id) OR 
  EXISTS (
    SELECT 1 FROM task_board_members tbm 
    WHERE tbm.board_id = task_board_members.board_id 
    AND tbm.user_id = auth.uid() 
    AND tbm.role = 'admin'
  )
);