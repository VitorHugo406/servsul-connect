
-- Drop existing restrictive policies on board_share_links
DROP POLICY IF EXISTS "Anyone can look up active share links by token" ON public.board_share_links;
DROP POLICY IF EXISTS "Board admin/owner can manage share links" ON public.board_share_links;
DROP POLICY IF EXISTS "Board members can view share links" ON public.board_share_links;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Anyone can look up active share links by token"
ON public.board_share_links
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Board admin/owner can manage share links"
ON public.board_share_links
FOR ALL
TO authenticated
USING (is_board_admin_or_owner(board_id));

CREATE POLICY "Board members can view share links"
ON public.board_share_links
FOR SELECT
TO authenticated
USING (is_board_member(board_id));
