DROP POLICY IF EXISTS "Users can view attachments in messages they can see" ON public.attachments;
CREATE POLICY "Users can view attachments in messages they can see"
ON public.attachments
FOR SELECT TO authenticated
USING (
  (
    message_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = public.attachments.message_id
        AND public.same_company(m.company_id)
        AND (m.sector_id = public.get_current_sector_id()
             OR m.sector_id = '00000000-0000-0000-0000-000000000001'::uuid
             OR public.is_admin()
             OR public.user_has_sector_access((SELECT auth.uid()),m.sector_id))
    )
  )
  OR (
    direct_message_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = public.attachments.direct_message_id
        AND dm.company_id = public.current_company_id()
        AND (dm.sender_id = public.get_current_profile_id() OR dm.receiver_id = public.get_current_profile_id())
    )
  )
  OR (
    announcement_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = public.attachments.announcement_id
        AND public.same_company(a.company_id)
    )
  )
  OR (
    uploaded_by = public.get_current_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = public.attachments.uploaded_by
        AND p.user_id = (SELECT auth.uid())
        AND p.is_active = true
        AND public.same_company(p.company_id)
    )
    AND (message_id IS NULL OR EXISTS (SELECT 1 FROM public.messages m WHERE m.id=public.attachments.message_id AND public.same_company(m.company_id)))
    AND (direct_message_id IS NULL OR EXISTS (SELECT 1 FROM public.direct_messages dm WHERE dm.id=public.attachments.direct_message_id AND dm.company_id=public.current_company_id()))
    AND (announcement_id IS NULL OR EXISTS (SELECT 1 FROM public.announcements a WHERE a.id=public.attachments.announcement_id AND public.same_company(a.company_id)))
  )
  OR (
    public.is_admin()
    AND (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=public.attachments.uploaded_by AND public.same_company(p.company_id))
      OR EXISTS (SELECT 1 FROM public.messages m WHERE m.id=public.attachments.message_id AND public.same_company(m.company_id))
      OR EXISTS (SELECT 1 FROM public.direct_messages dm WHERE dm.id=public.attachments.direct_message_id AND dm.company_id=public.current_company_id())
      OR EXISTS (SELECT 1 FROM public.announcements a WHERE a.id=public.attachments.announcement_id AND public.same_company(a.company_id))
    )
  )
);

DROP POLICY IF EXISTS "Users can delete own attachments" ON public.attachments;
CREATE POLICY "Users can delete own attachments"
ON public.attachments
FOR DELETE TO authenticated
USING (
  (
    uploaded_by = public.get_current_profile_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id=public.attachments.uploaded_by AND p.user_id=(SELECT auth.uid())
        AND p.is_active=true AND public.same_company(p.company_id)
    )
    AND (message_id IS NULL OR EXISTS (SELECT 1 FROM public.messages m WHERE m.id=public.attachments.message_id AND public.same_company(m.company_id)))
    AND (direct_message_id IS NULL OR EXISTS (SELECT 1 FROM public.direct_messages dm WHERE dm.id=public.attachments.direct_message_id AND dm.company_id=public.current_company_id()))
    AND (announcement_id IS NULL OR EXISTS (SELECT 1 FROM public.announcements a WHERE a.id=public.attachments.announcement_id AND public.same_company(a.company_id)))
  )
  OR (
    public.is_admin()
    AND (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=public.attachments.uploaded_by AND public.same_company(p.company_id))
      OR EXISTS (SELECT 1 FROM public.messages m WHERE m.id=public.attachments.message_id AND public.same_company(m.company_id))
      OR EXISTS (SELECT 1 FROM public.direct_messages dm WHERE dm.id=public.attachments.direct_message_id AND dm.company_id=public.current_company_id())
      OR EXISTS (SELECT 1 FROM public.announcements a WHERE a.id=public.attachments.announcement_id AND public.same_company(a.company_id))
    )
  )
);
