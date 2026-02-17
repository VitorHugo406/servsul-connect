
-- Fix RLS on system_settings: drop restrictive policy and create permissive one for weekly_file_limit
DROP POLICY IF EXISTS "Authenticated users can read weekly_file_limit" ON public.system_settings;

-- Create a PERMISSIVE policy so non-admin users can read weekly_file_limit
CREATE POLICY "Anyone authenticated can read weekly_file_limit"
ON public.system_settings
FOR SELECT
USING (auth.uid() IS NOT NULL AND key = 'weekly_file_limit');

-- Add ip_address column to audit_logs for tracking
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address text;

-- Update log_deletion trigger to support ip from session variable
CREATE OR REPLACE FUNCTION public.log_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  performer_id UUID;
  performer_email TEXT;
  record_desc TEXT;
  client_ip TEXT;
BEGIN
  performer_id := auth.uid();
  
  SELECT email INTO performer_email
  FROM public.profiles
  WHERE user_id = performer_id
  LIMIT 1;

  -- Try to get client IP from session variable
  BEGIN
    client_ip := current_setting('app.client_ip', true);
  EXCEPTION WHEN OTHERS THEN
    client_ip := NULL;
  END;

  -- Build a meaningful description based on the table
  record_desc := TG_TABLE_NAME || ' record deleted';
  
  IF TG_TABLE_NAME = 'profiles' THEN
    record_desc := 'Perfil excluído: ' || COALESCE(OLD.name, OLD.email, OLD.id::text);
  ELSIF TG_TABLE_NAME = 'messages' THEN
    record_desc := 'Mensagem excluída do chat';
  ELSIF TG_TABLE_NAME = 'announcements' THEN
    record_desc := 'Aviso excluído: ' || COALESCE(OLD.title, OLD.id::text);
  ELSIF TG_TABLE_NAME = 'direct_messages' THEN
    record_desc := 'Mensagem direta excluída';
  ELSIF TG_TABLE_NAME = 'tasks' THEN
    record_desc := 'Tarefa excluída: ' || COALESCE(OLD.title, OLD.id::text);
  ELSIF TG_TABLE_NAME = 'sectors' THEN
    record_desc := 'Setor excluído: ' || COALESCE(OLD.name, OLD.id::text);
  ELSIF TG_TABLE_NAME = 'task_boards' THEN
    record_desc := 'Quadro excluído: ' || COALESCE(OLD.name, OLD.id::text);
  ELSIF TG_TABLE_NAME = 'private_groups' THEN
    record_desc := 'Grupo privado excluído: ' || COALESCE(OLD.name, OLD.id::text);
  ELSIF TG_TABLE_NAME = 'important_announcements' THEN
    record_desc := 'Comunicado importante excluído: ' || COALESCE(OLD.title, OLD.id::text);
  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    record_desc := 'Role removida: ' || OLD.role::text;
  ELSIF TG_TABLE_NAME = 'user_permissions' THEN
    record_desc := 'Permissões removidas';
  ELSIF TG_TABLE_NAME = 'attachments' THEN
    record_desc := 'Anexo excluído: ' || COALESCE(OLD.file_name, OLD.id::text);
  END IF;

  INSERT INTO public.audit_logs (table_name, action, record_id, record_data, description, performed_by, performed_by_email, ip_address)
  VALUES (
    TG_TABLE_NAME,
    'DELETE',
    OLD.id::text,
    to_jsonb(OLD),
    record_desc,
    performer_id,
    COALESCE(performer_email, 'sistema'),
    client_ip
  );

  RETURN OLD;
END;
$function$;
