-- Attachment metadata must never point at another tenant's resource.
DROP POLICY IF EXISTS "Users can upload attachments" ON public.attachments;
CREATE POLICY "Users can upload attachments"
ON public.attachments
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = public.get_current_profile_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = public.attachments.uploaded_by
      AND p.user_id = (SELECT auth.uid())
      AND p.is_active = true
      AND public.same_company(p.company_id)
  )
  AND (
    (message_id IS NULL AND direct_message_id IS NULL AND announcement_id IS NULL)
    OR (
      (message_id IS NULL OR EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.id = public.attachments.message_id
          AND public.same_company(m.company_id)
          AND (m.sector_id = public.get_current_sector_id()
               OR m.sector_id = '00000000-0000-0000-0000-000000000001'::uuid
               OR public.is_admin()
               OR public.user_has_sector_access((SELECT auth.uid()),m.sector_id))
      ))
      AND (direct_message_id IS NULL OR EXISTS (
        SELECT 1 FROM public.direct_messages dm
        WHERE dm.id = public.attachments.direct_message_id
          AND dm.company_id = public.current_company_id()
          AND (dm.sender_id = public.get_current_profile_id() OR dm.receiver_id = public.get_current_profile_id())
      ))
      AND (announcement_id IS NULL OR EXISTS (
        SELECT 1 FROM public.announcements a
        WHERE a.id = public.attachments.announcement_id
          AND public.same_company(a.company_id)
      ))
    )
  )
);

-- Comments must belong to an announcement in the caller's company.
DROP POLICY IF EXISTS "Usuários podem criar comentários" ON public.announcement_comments;
CREATE POLICY "Usuários podem criar comentários"
ON public.announcement_comments
FOR INSERT TO authenticated
WITH CHECK (
  author_id = public.get_current_profile_id()
  AND EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = public.announcement_comments.announcement_id
      AND public.same_company(a.company_id)
  )
);

-- Reactions must point to a message visible to the active user in the same tenant/sector.
DROP POLICY IF EXISTS "Users can add own reactions" ON public.message_reactions;
CREATE POLICY "Users can add own reactions"
ON public.message_reactions
FOR INSERT TO authenticated
WITH CHECK (
  profile_id = public.get_current_profile_id()
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = public.message_reactions.message_id
      AND public.same_company(m.company_id)
      AND (m.sector_id = public.get_current_sector_id()
           OR m.sector_id = '00000000-0000-0000-0000-000000000001'::uuid
           OR public.is_admin()
           OR public.user_has_sector_access((SELECT auth.uid()),m.sector_id))
  )
);

-- Join requests can only be made for boards in the user's company.
DROP POLICY IF EXISTS "Users can insert join requests" ON public.board_join_requests;
CREATE POLICY "Users can insert join requests"
ON public.board_join_requests
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.task_boards b ON b.id = public.board_join_requests.board_id
    WHERE p.user_id = (SELECT auth.uid())
      AND p.is_active = true
      AND p.company_id = b.company_id
      AND public.same_company(b.company_id)
  )
);

-- Owners cannot delete a board if it is no longer within their active tenant.
DROP POLICY IF EXISTS "Board owners can delete boards" ON public.task_boards;
CREATE POLICY "Board owners can delete boards"
ON public.task_boards
FOR DELETE TO authenticated
USING (
  owner_id = (SELECT auth.uid())
  AND public.same_company(company_id)
);
