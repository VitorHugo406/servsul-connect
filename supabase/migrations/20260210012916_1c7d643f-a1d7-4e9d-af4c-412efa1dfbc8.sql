
-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL, -- 'DELETE', 'INSERT', 'UPDATE', 'SYSTEM'
  record_id TEXT,
  record_data JSONB,
  description TEXT,
  performed_by UUID,
  performed_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only the main admin can view logs
CREATE POLICY "Only admin can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (is_admin());

-- Only admin can delete logs
CREATE POLICY "Only admin can delete audit logs"
  ON public.audit_logs FOR DELETE
  TO authenticated
  USING (is_admin());

-- Allow inserts from triggers (security definer functions)
CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Create a generic audit trigger function
CREATE OR REPLACE FUNCTION public.log_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  performer_id UUID;
  performer_email TEXT;
  record_desc TEXT;
BEGIN
  performer_id := auth.uid();
  
  SELECT email INTO performer_email
  FROM public.profiles
  WHERE user_id = performer_id
  LIMIT 1;

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

  INSERT INTO public.audit_logs (table_name, action, record_id, record_data, description, performed_by, performed_by_email)
  VALUES (
    TG_TABLE_NAME,
    'DELETE',
    OLD.id::text,
    to_jsonb(OLD),
    record_desc,
    performer_id,
    COALESCE(performer_email, 'sistema')
  );

  RETURN OLD;
END;
$$;

-- Attach triggers to key tables
CREATE TRIGGER audit_profiles_delete BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER audit_messages_delete BEFORE DELETE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER audit_announcements_delete BEFORE DELETE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER audit_direct_messages_delete BEFORE DELETE ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER audit_tasks_delete BEFORE DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER audit_sectors_delete BEFORE DELETE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER audit_task_boards_delete BEFORE DELETE ON public.task_boards FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER audit_private_groups_delete BEFORE DELETE ON public.private_groups FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER audit_important_announcements_delete BEFORE DELETE ON public.important_announcements FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER audit_user_roles_delete BEFORE DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER audit_user_permissions_delete BEFORE DELETE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
CREATE TRIGGER audit_attachments_delete BEFORE DELETE ON public.attachments FOR EACH ROW EXECUTE FUNCTION public.log_deletion();
