CREATE OR REPLACE FUNCTION public.set_company_id_default()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE j jsonb := to_jsonb(NEW); pid uuid;
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.current_company_id();
  END IF;
  -- Server-side inserts (automations) have no auth context: derive from the author
  IF NEW.company_id IS NULL THEN
    pid := COALESCE(NULLIF(j->>'author_id','')::uuid, NULLIF(j->>'sender_id','')::uuid, NULLIF(j->>'created_by','')::uuid);
    IF pid IS NOT NULL THEN
      SELECT company_id INTO NEW.company_id FROM public.profiles WHERE id = pid OR user_id = pid LIMIT 1;
    END IF;
  END IF;
  IF NEW.company_id IS NULL AND j ? 'board_id' AND j->>'board_id' IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.task_boards WHERE id = (j->>'board_id')::uuid;
  END IF;
  IF NEW.company_id IS NULL AND j ? 'sector_id' AND j->>'sector_id' IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.sectors WHERE id = (j->>'sector_id')::uuid;
  END IF;
  RETURN NEW;
END;
$function$;