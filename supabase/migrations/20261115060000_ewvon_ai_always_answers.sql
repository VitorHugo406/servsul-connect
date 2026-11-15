-- @ewvonai always reaches the edge function; when the company has no AI key it answers with the "contact the admin" notice.
CREATE OR REPLACE FUNCTION public.ai_on_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; who uuid;
BEGIN
  IF NEW.content IS NULL OR NEW.content !~* '@ewvon\s?ai' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'messages' THEN cid := NEW.company_id; who := NEW.author_id;
  ELSIF TG_TABLE_NAME = 'direct_messages' THEN cid := NEW.company_id; who := NEW.sender_id;
  ELSIF TG_TABLE_NAME = 'private_group_messages' THEN SELECT company_id INTO cid FROM public.private_groups WHERE id = NEW.group_id; who := NEW.sender_id;
  ELSE RETURN NEW; END IF;
  IF who IN (public.ai_sender_id(), public.system_sender_id()) THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/ewvon-ai/ask',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-integrations-secret', s.decrypted_secret),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id)
  ) FROM vault.decrypted_secrets s WHERE s.name = 'integrations_secret';
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ai_on_message: %', SQLERRM;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.ai_on_message() FROM public, anon, authenticated;
