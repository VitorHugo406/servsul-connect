
-- Fix attachments SELECT policy: enforce same_company scoping via announcement
DROP POLICY IF EXISTS "Users can view attachments in messages they can see" ON public.attachments;
CREATE POLICY "Users can view attachments in messages they can see"
ON public.attachments FOR SELECT
USING (
  (message_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = attachments.message_id
      AND public.user_has_sector_access(auth.uid(), m.sector_id)
  ))
  OR (direct_message_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.direct_messages dm
    WHERE dm.id = attachments.direct_message_id
      AND (dm.sender_id = public.get_current_profile_id() OR dm.receiver_id = public.get_current_profile_id())
  ))
  OR (announcement_id IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = attachments.announcement_id
      AND public.same_company(a.company_id)
  ))
  OR (uploaded_by = public.get_current_profile_id())
  OR public.is_admin()
);

-- Fix storage.objects SELECT policy for attachments bucket: exact path match, not LIKE
DROP POLICY IF EXISTS "Users can view permitted attachment files" ON storage.objects;
CREATE POLICY "Users can view permitted attachment files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'attachments'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.attachments a
      WHERE split_part(split_part(a.file_url, '/attachments/', 2), '?', 1) = objects.name
        AND (
          (a.message_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.messages m
            WHERE m.id = a.message_id
              AND public.user_has_sector_access(auth.uid(), m.sector_id)
          ))
          OR (a.direct_message_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.direct_messages dm
            WHERE dm.id = a.direct_message_id
              AND (dm.sender_id = public.get_current_profile_id() OR dm.receiver_id = public.get_current_profile_id())
          ))
          OR (a.announcement_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.announcements an
            WHERE an.id = a.announcement_id
              AND public.same_company(an.company_id)
          ))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE split_part(split_part(t.cover_image, '/attachments/', 2), '?', 1) = objects.name
        AND public.is_board_member(t.board_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.task_board_columns c
      WHERE split_part(split_part(c.auto_cover, '/attachments/', 2), '?', 1) = objects.name
        AND public.is_board_member(c.board_id)
    )
  )
);
