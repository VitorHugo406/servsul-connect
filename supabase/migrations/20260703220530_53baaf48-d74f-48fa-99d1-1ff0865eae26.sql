
-- 1. announcement_comments: require authenticated
DROP POLICY IF EXISTS "Todos podem ver comentários" ON public.announcement_comments;
CREATE POLICY "Usuarios autenticados podem ver comentarios"
  ON public.announcement_comments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 2. attachments: add auth check on announcement path
DROP POLICY IF EXISTS "Users can view attachments in messages they can see" ON public.attachments;
CREATE POLICY "Users can view attachments in messages they can see"
  ON public.attachments FOR SELECT
  TO authenticated
  USING (
    ((message_id IS NOT NULL) AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = attachments.message_id
        AND public.user_has_sector_access(auth.uid(), m.sector_id)
    ))
    OR ((direct_message_id IS NOT NULL) AND EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = attachments.direct_message_id
        AND (dm.sender_id = public.get_current_profile_id() OR dm.receiver_id = public.get_current_profile_id())
    ))
    OR ((announcement_id IS NOT NULL) AND auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = attachments.announcement_id
    ))
  );

-- 3. board_share_links: drop broad token lookup, expose only via RPC
DROP POLICY IF EXISTS "Anyone can look up active share links by token" ON public.board_share_links;

CREATE OR REPLACE FUNCTION public.resolve_board_share_link(_token text)
RETURNS TABLE(board_id uuid, board_name text, board_description text, is_active boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  RETURN QUERY
    SELECT bsl.board_id, tb.name, tb.description, bsl.is_active
    FROM public.board_share_links bsl
    JOIN public.task_boards tb ON tb.id = bsl.board_id
    WHERE bsl.share_token = _token
      AND bsl.is_active = true
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_board_share_link(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_board_share_link(text) TO authenticated, service_role;
