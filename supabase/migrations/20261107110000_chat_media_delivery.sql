-- Chat media like WhatsApp: the server copy is removed as soon as every
-- recipient has downloaded it to their device, or after 7 days at most.
UPDATE public.system_settings SET value = '7', updated_at = now() WHERE key = 'chat_media_retention_days';

ALTER TABLE public.attachment_lifecycle ADD COLUMN IF NOT EXISTS pending_recipients uuid[];

-- When a message carrying chat media is sent, store who still has to receive it.
CREATE OR REPLACE FUNCTION public.set_chat_media_recipients()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m text[];
  v_path text;
  v_author uuid;
  v_recipients uuid[];
  v_sector uuid;
  v_company uuid;
BEGIN
  IF NEW.content IS NULL OR position('/chat/' IN NEW.content) = 0 THEN RETURN NEW; END IF;
  BEGIN
    IF TG_TABLE_NAME = 'messages' THEN
      v_author := NEW.author_id; v_sector := NEW.sector_id; v_company := NEW.company_id;
      IF v_sector = '00000000-0000-0000-0000-000000000001'::uuid THEN
        SELECT array_agg(p.id) INTO v_recipients FROM public.profiles p
        WHERE p.company_id = v_company AND p.is_active AND p.id <> v_author;
      ELSE
        SELECT array_agg(DISTINCT p.id) INTO v_recipients FROM public.profiles p
        WHERE p.company_id = v_company AND p.is_active AND p.id <> v_author
          AND (p.sector_id = v_sector OR EXISTS (SELECT 1 FROM public.user_additional_sectors s WHERE s.user_id = p.user_id AND s.sector_id = v_sector));
      END IF;
    ELSIF TG_TABLE_NAME = 'direct_messages' THEN
      v_author := NEW.sender_id; v_recipients := ARRAY[NEW.receiver_id];
    ELSE
      v_author := NEW.sender_id;
      SELECT array_agg(gm.profile_id) INTO v_recipients FROM public.private_group_members gm
      WHERE gm.group_id = NEW.group_id AND gm.profile_id <> NEW.sender_id;
    END IF;
    FOR m IN SELECT regexp_matches(NEW.content, '/attachments/([^[:space:]"()<>?#]+/chat/[^[:space:]"()<>?#]+)', 'g') LOOP
      v_path := m[1];
      UPDATE public.attachment_lifecycle
         SET pending_recipients = COALESCE(v_recipients, '{}'),
             temporary_expires_at = CASE WHEN COALESCE(array_length(v_recipients, 1), 0) = 0 THEN now() ELSE temporary_expires_at END
       WHERE storage_bucket = 'attachments' AND storage_path = v_path AND status = 'temporary' AND pending_recipients IS NULL;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'set_chat_media_recipients: %', SQLERRM;  -- never block sending
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS z_chat_media_recipients ON public.messages;
CREATE TRIGGER z_chat_media_recipients AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_chat_media_recipients();
DROP TRIGGER IF EXISTS z_chat_media_recipients ON public.direct_messages;
CREATE TRIGGER z_chat_media_recipients AFTER INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.set_chat_media_recipients();
DROP TRIGGER IF EXISTS z_chat_media_recipients ON public.private_group_messages;
CREATE TRIGGER z_chat_media_recipients AFTER INSERT ON public.private_group_messages FOR EACH ROW EXECUTE FUNCTION public.set_chat_media_recipients();

-- A device confirms it saved the media; when nobody is left, the server copy is
-- released (cleanup-expired-attachments removes it within ~15 minutes).
CREATE OR REPLACE FUNCTION public.ack_chat_media(_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := public.get_current_profile_id();
  left_count integer;
BEGIN
  IF me IS NULL OR _path IS NULL OR split_part(_path, '/', 2) <> 'chat' THEN RETURN false; END IF;
  IF NOT public.can_read_attachment_object(_path) THEN RETURN false; END IF;
  UPDATE public.attachment_lifecycle
     SET pending_recipients = array_remove(pending_recipients, me)
   WHERE storage_bucket = 'attachments' AND storage_path = _path AND status = 'temporary' AND me = ANY(pending_recipients)
  RETURNING COALESCE(array_length(pending_recipients, 1), 0) INTO left_count;
  IF left_count = 0 THEN
    UPDATE public.attachment_lifecycle SET temporary_expires_at = now()
     WHERE storage_bucket = 'attachments' AND storage_path = _path AND status = 'temporary';
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.ack_chat_media(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ack_chat_media(text) TO authenticated;

-- uploaded_by references auth.users: register with the auth user id.
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
  SELECT GREATEST(1, LEAST(365, COALESCE(NULLIF(value, '')::integer, 7))) INTO days FROM public.system_settings WHERE key = 'chat_media_retention_days';
  expires := now() + make_interval(days => COALESCE(days, 7));
  INSERT INTO public.attachment_lifecycle (storage_bucket, storage_path, uploaded_by, status, temporary_expires_at)
  VALUES ('attachments', _path, auth.uid(), 'temporary', expires)
  ON CONFLICT (storage_bucket, storage_path) DO NOTHING;
  RETURN expires;
END $$;

-- One-off: remove every file currently in the attachments bucket (102 files,
-- all chat media or unreferenced uploads; no task or announcement files).
INSERT INTO public.attachment_lifecycle (storage_bucket, storage_path, uploaded_by, status, temporary_expires_at)
SELECT 'attachments', o.name,
       COALESCE((SELECT u.id FROM auth.users u WHERE u.id = o.owner),
                (SELECT u.id FROM auth.users u WHERE u.id::text = split_part(o.name, '/', 1)),
                (SELECT ur.user_id FROM public.user_roles ur WHERE ur.role::text = 'super_admin' LIMIT 1)),
       'temporary', now()
FROM storage.objects o WHERE o.bucket_id = 'attachments'
ON CONFLICT (storage_bucket, storage_path) DO UPDATE SET status = 'temporary', temporary_expires_at = now(), temporary_deleted_at = NULL;
