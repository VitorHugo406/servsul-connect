-- WhatsApp-like chat media: photos/files sent in conversations stay on the
-- server only for a retention window (default 30 days, setting
-- chat_media_retention_days). Devices that opened the media keep their own copy
-- (browser/app cache), so the server does not keep everything forever.
-- Chat uploads live under <uid>/chat/...; task covers and announcement files
-- (other paths) are never expired. The existing cleanup-expired-attachments job
-- deletes rows of attachment_lifecycle once temporary_expires_at passes.

INSERT INTO public.system_settings (key, value)
SELECT 'chat_media_retention_days', '30'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'chat_media_retention_days');

-- No more weekly upload limit.
DELETE FROM public.system_settings WHERE key = 'weekly_file_limit';

CREATE UNIQUE INDEX IF NOT EXISTS attachment_lifecycle_object_uidx ON public.attachment_lifecycle (storage_bucket, storage_path);

CREATE OR REPLACE FUNCTION public.register_chat_media(_path text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  days integer;
  expires timestamptz;
BEGIN
  IF auth.uid() IS NULL OR _path IS NULL OR _path LIKE '%..%'
     OR split_part(_path, '/', 1) <> auth.uid()::text OR split_part(_path, '/', 2) <> 'chat' THEN
    RAISE EXCEPTION 'invalid media path' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'attachments' AND o.name = _path) THEN
    RAISE EXCEPTION 'media not found';
  END IF;
  SELECT GREATEST(1, LEAST(365, COALESCE(NULLIF(value, '')::integer, 30))) INTO days FROM public.system_settings WHERE key = 'chat_media_retention_days';
  expires := now() + make_interval(days => COALESCE(days, 30));
  INSERT INTO public.attachment_lifecycle (storage_bucket, storage_path, uploaded_by, status, temporary_expires_at)
  VALUES ('attachments', _path, public.get_current_profile_id(), 'temporary', expires)
  ON CONFLICT (storage_bucket, storage_path) DO NOTHING;
  RETURN expires;
END $$;
REVOKE ALL ON FUNCTION public.register_chat_media(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_chat_media(text) TO authenticated;

-- Private-group members can open photos/files sent in their groups (they were
-- only readable for sector and direct messages).
CREATE OR REPLACE FUNCTION public.can_read_attachment_object(_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND _name IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.attachments a
        WHERE split_part(split_part(a.file_url, '/attachments/', 2), '?', 1) = _name
          AND (
            (a.message_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.messages m
              WHERE m.id = a.message_id
                AND public.same_company(m.company_id)
                AND public.user_has_sector_access(auth.uid(), m.sector_id)))
            OR (a.direct_message_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.direct_messages dm
              WHERE dm.id = a.direct_message_id
                AND dm.company_id = public.current_company_id()
                AND (dm.sender_id = public.get_current_profile_id()
                     OR dm.receiver_id = public.get_current_profile_id())))
            OR (a.announcement_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.announcements an
              WHERE an.id = a.announcement_id
                AND public.same_company(an.company_id)))
          )
      )
      OR (split_part(_name, '/', 2) = 'chat' AND EXISTS (
        SELECT 1
        FROM public.private_group_messages gm
        JOIN public.private_groups g ON g.id = gm.group_id
        WHERE g.company_id = public.current_company_id()
          AND public.is_group_member(gm.group_id)
          AND gm.created_at >= now() - interval '400 days'
          AND position('/attachments/' || _name IN gm.content) > 0
      ))
      OR EXISTS (
        SELECT 1
        FROM public.tasks t
        JOIN public.task_boards b ON b.id = t.board_id AND b.company_id = t.company_id
        WHERE t.cover_image IS NOT NULL
          AND split_part(split_part(t.cover_image, '/attachments/', 2), '?', 1) = _name
          AND public.same_company(t.company_id)
          AND public.is_board_member(t.board_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.task_board_columns c
        JOIN public.task_boards b ON b.id = c.board_id
        WHERE c.auto_cover IS NOT NULL
          AND split_part(split_part(c.auto_cover, '/attachments/', 2), '?', 1) = _name
          AND public.same_company(b.company_id)
          AND public.is_board_member(c.board_id)
      )
    );
$function$;
