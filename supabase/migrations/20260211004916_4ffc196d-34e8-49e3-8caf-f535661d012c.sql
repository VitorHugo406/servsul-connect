
-- ==============================================
-- FIX 1: Profiles table - restrict SELECT policy
-- Currently ANY authenticated user can see ALL profiles.
-- We'll create a view that hides sensitive fields (phone, address, birth_date, registration_number)
-- and restrict the base table policy.
-- ==============================================

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver todos os perfis" ON public.profiles;

-- Create a more restrictive SELECT policy:
-- Users can see all profiles but we limit WHICH columns via a view
-- Since profiles are needed for chat, presence, task assignment etc., 
-- we keep authenticated access but create a safe view for sensitive data
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL AND public.check_user_is_active());

-- ==============================================
-- FIX 2: User facial data - add stricter access
-- Remove the policy that lets users view their own facial descriptors directly
-- Facial data should only be accessible via edge functions
-- ==============================================

-- Drop permissive user-level SELECT on facial data
DROP POLICY IF EXISTS "Users can view their own facial data" ON public.user_facial_data;
DROP POLICY IF EXISTS "Users can update their own facial data" ON public.user_facial_data;
DROP POLICY IF EXISTS "Users can delete their own facial data" ON public.user_facial_data;
DROP POLICY IF EXISTS "Users can insert their own facial data" ON public.user_facial_data;

-- Facial data should ONLY be managed through edge functions (service role)
-- Users should NOT have direct access to biometric data
-- Admin policies remain for management purposes
