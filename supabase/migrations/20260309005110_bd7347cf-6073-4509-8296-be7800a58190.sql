-- Ajustes de acesso temporário via War Room e bloqueio de leitura de cards de mural por setor

-- 1) TASKS: impedir que a policy por setor libere cards de mural (board_id NOT NULL)
DROP POLICY IF EXISTS "Users can view tasks in their sectors" ON public.tasks;
CREATE POLICY "Users can view tasks in their sectors"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  is_admin()
  OR (
    board_id IS NULL
    AND (
      sector_id IS NULL
      OR sector_id = get_current_sector_id()
      OR sector_id = '00000000-0000-0000-0000-000000000001'::uuid
      OR EXISTS (
        SELECT 1
        FROM public.user_additional_sectors uas
        WHERE uas.user_id = auth.uid()
          AND uas.sector_id = public.tasks.sector_id
      )
    )
  )
);

-- 2) TASK_BOARDS: permitir SELECT para membros do War Room (somente boards que tenham o card vinculado)
DROP POLICY IF EXISTS "Board members and owners can view boards" ON public.task_boards;
CREATE POLICY "Board members and owners can view boards"
ON public.task_boards
FOR SELECT
TO authenticated
USING (
  is_board_member(id)
  OR owner_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.war_rooms wr
    JOIN public.war_room_members wrm ON wrm.war_room_id = wr.id
    JOIN public.tasks t ON t.id = wr.task_id
    WHERE wrm.user_id = auth.uid()
      AND t.board_id = public.task_boards.id
      AND (
        wr.status = 'active'
        OR (
          wr.closed_at IS NOT NULL
          AND wr.closed_at > (now() - interval '5 days')
        )
      )
  )
);

-- 3) TASK_BOARD_COLUMNS: permitir SELECT para membros do War Room (para o mesmo board)
DROP POLICY IF EXISTS "Board members can view columns" ON public.task_board_columns;
CREATE POLICY "Board members can view columns"
ON public.task_board_columns
FOR SELECT
TO authenticated
USING (
  is_board_member(board_id)
  OR EXISTS (
    SELECT 1
    FROM public.war_rooms wr
    JOIN public.war_room_members wrm ON wrm.war_room_id = wr.id
    JOIN public.tasks t ON t.id = wr.task_id
    WHERE wrm.user_id = auth.uid()
      AND t.board_id = public.task_board_columns.board_id
      AND (
        wr.status = 'active'
        OR (
          wr.closed_at IS NOT NULL
          AND wr.closed_at > (now() - interval '5 days')
        )
      )
  )
);
