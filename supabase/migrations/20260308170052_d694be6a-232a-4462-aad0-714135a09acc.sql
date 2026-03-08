
-- Board share links table
CREATE TABLE IF NOT EXISTS public.board_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES public.task_boards(id) ON DELETE CASCADE NOT NULL,
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by uuid NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.board_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can view share links"
ON public.board_share_links FOR SELECT TO authenticated
USING (public.is_board_member(board_id));

CREATE POLICY "Board admin/owner can manage share links"
ON public.board_share_links FOR ALL TO authenticated
USING (public.is_board_admin_or_owner(board_id));

-- Board join requests table
CREATE TABLE IF NOT EXISTS public.board_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES public.task_boards(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  resolved_at timestamptz,
  resolved_by uuid,
  UNIQUE(board_id, user_id, status)
);

ALTER TABLE public.board_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own join requests"
ON public.board_join_requests FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_board_admin_or_owner(board_id));

CREATE POLICY "Users can insert join requests"
ON public.board_join_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Board admin/owner can update join requests"
ON public.board_join_requests FOR UPDATE TO authenticated
USING (public.is_board_admin_or_owner(board_id));

-- Allow anyone authenticated to look up share links by token
CREATE POLICY "Anyone can look up active share links by token"
ON public.board_share_links FOR SELECT TO authenticated
USING (is_active = true);
