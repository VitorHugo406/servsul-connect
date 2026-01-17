-- 1. Create the "Geral" sector (fixed ID for reference)
INSERT INTO public.sectors (id, name, color, icon)
VALUES ('00000000-0000-0000-0000-000000000001', 'Geral', '#6B7280', 'users')
ON CONFLICT (id) DO NOTHING;

-- 2. Create app_role enum for user roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'gerente', 'supervisor', 'colaborador');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 4. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 6. Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- 7. Create system_settings table for registration password
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Enable RLS on system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 9. Insert the registration password (hashed for security display but we'll use plain for validation in edge function)
INSERT INTO public.system_settings (key, value)
VALUES ('registration_password', 'Senh@Cast753')
ON CONFLICT (key) DO UPDATE SET value = 'Senh@Cast753';

-- 10. RLS policies for user_roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 11. RLS policies for system_settings (only admin can access)
CREATE POLICY "Only admins can view system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Only admins can manage system settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 12. Update messages RLS to allow access to Geral sector for all users
DROP POLICY IF EXISTS "Usuários podem ver mensagens do seu setor" ON public.messages;
CREATE POLICY "Usuários podem ver mensagens do seu setor ou Geral"
ON public.messages
FOR SELECT
USING (
  sector_id = get_current_sector_id() 
  OR sector_id = '00000000-0000-0000-0000-000000000001'::uuid
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Usuários podem criar mensagens no seu setor" ON public.messages;
CREATE POLICY "Usuários podem criar mensagens no seu setor ou Geral"
ON public.messages
FOR INSERT
WITH CHECK (
  author_id = get_current_profile_id() 
  AND (sector_id = get_current_sector_id() OR sector_id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- 13. Update trigger for system_settings
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 14. Create policy to allow service role to insert user_roles (for edge function)
CREATE POLICY "Service role can insert roles"
ON public.user_roles
FOR INSERT
TO service_role
WITH CHECK (true);