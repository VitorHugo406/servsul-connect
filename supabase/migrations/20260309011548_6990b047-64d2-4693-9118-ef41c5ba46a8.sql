-- Remove acesso ao mural após encerramento da War Room
-- Antes: acesso permanecia por 5 dias após encerramento
-- Agora: acesso revogado imediatamente quando status != 'active'

-- Atualizar política de visualização de boards
DROP POLICY IF EXISTS "Board members and owners can view boards" ON public.task_boards;
CREATE POLICY "Board members and owners can view boards"
ON public.task_boards FOR SELECT USING (
  is_board_member(id) OR owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.war_rooms wr
    JOIN public.war_room_members wrm ON wrm.war_room_id = wr.id
    JOIN public.tasks t ON t.id = wr.task_id
    WHERE wrm.user_id = auth.uid() 
      AND t.board_id = public.task_boards.id
      AND wr.status = 'active'
  )
);

-- Atualizar política de visualização de colunas
DROP POLICY IF EXISTS "Board members and war room members can view columns" ON public.task_board_columns;
CREATE POLICY "Board members and war room members can view columns"
ON public.task_board_columns FOR SELECT USING (
  is_board_member(board_id) OR EXISTS (
    SELECT 1 FROM public.war_rooms wr
    JOIN public.war_room_members wrm ON wrm.war_room_id = wr.id
    JOIN public.tasks t ON t.id = wr.task_id
    WHERE wrm.user_id = auth.uid() 
      AND t.board_id = public.task_board_columns.board_id
      AND wr.status = 'active'
  )
);

-- Atualizar política de visualização de tasks vinculadas
DROP POLICY IF EXISTS "War room members can view linked task" ON public.tasks;
CREATE POLICY "War room members can view linked task"
ON public.tasks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM war_rooms wr
    JOIN war_room_members wrm ON wrm.war_room_id = wr.id
    WHERE wr.task_id = tasks.id 
      AND wrm.user_id = auth.uid()
      AND wr.status = 'active'
  )
);

-- Atualizar política de atualização de tasks vinculadas
DROP POLICY IF EXISTS "War room members can update linked task" ON public.tasks;
CREATE POLICY "War room members can update linked task"
ON public.tasks FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM war_rooms wr
    JOIN war_room_members wrm ON wrm.war_room_id = wr.id
    WHERE wr.task_id = tasks.id 
      AND wrm.user_id = auth.uid()
      AND wr.status = 'active'
  )
);