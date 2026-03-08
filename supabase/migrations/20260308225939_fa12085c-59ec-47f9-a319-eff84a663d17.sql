
CREATE TABLE public.task_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  decision_text TEXT NOT NULL,
  responsible_name TEXT NOT NULL,
  decision_date DATE NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can view task decisions"
  ON public.task_decisions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_decisions.task_id AND t.board_id IS NOT NULL AND is_board_member(t.board_id)
  ));

CREATE POLICY "Board members can insert task decisions"
  ON public.task_decisions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_decisions.task_id AND t.board_id IS NOT NULL AND is_board_member(t.board_id)
  ));

CREATE POLICY "Board members can delete task decisions"
  ON public.task_decisions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_decisions.task_id AND t.board_id IS NOT NULL AND is_board_member(t.board_id)
  ));
