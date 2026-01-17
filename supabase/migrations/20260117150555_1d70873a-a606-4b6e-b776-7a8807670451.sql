-- Add new fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS company text,
ADD COLUMN IF NOT EXISTS registration_number text,
ADD COLUMN IF NOT EXISTS profile_type text NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create user_permissions table for granular permissions
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_post_announcements boolean NOT NULL DEFAULT false,
  can_delete_messages boolean NOT NULL DEFAULT false,
  can_access_management boolean NOT NULL DEFAULT false,
  can_access_password_change boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create user_additional_sectors table for additional sector access
CREATE TABLE IF NOT EXISTS public.user_additional_sectors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, sector_id)
);

-- Enable RLS on new tables
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_additional_sectors ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_permissions
CREATE POLICY "Admins can manage all permissions"
ON public.user_permissions
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Users can view their own permissions"
ON public.user_permissions
FOR SELECT
USING (user_id = auth.uid());

-- RLS policies for user_additional_sectors
CREATE POLICY "Admins can manage all additional sectors"
ON public.user_additional_sectors
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Users can view their own additional sectors"
ON public.user_additional_sectors
FOR SELECT
USING (user_id = auth.uid());

-- Trigger to update updated_at on user_permissions
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if user has access to a specific sector
CREATE OR REPLACE FUNCTION public.user_has_sector_access(check_user_id uuid, check_sector_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admin has access to all sectors
    is_admin() OR
    -- Check if it's the Geral sector (everyone has access)
    check_sector_id = '00000000-0000-0000-0000-000000000001'::uuid OR
    -- Check if it's the user's primary sector
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = check_user_id AND sector_id = check_sector_id
    ) OR
    -- Check if it's in user's additional sectors
    EXISTS (
      SELECT 1 FROM public.user_additional_sectors 
      WHERE user_id = check_user_id AND sector_id = check_sector_id
    )
$$;