-- Helper security definer to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.is_note_owner(_note_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.notes WHERE id = _note_id AND owner_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_note_shared_with_me(_note_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.note_shares WHERE note_id = _note_id AND shared_with_user_id = auth.uid());
$$;

-- Drop old recursive policies
DROP POLICY IF EXISTS "Owners and shared users can view notes" ON public.notes;
DROP POLICY IF EXISTS "Owners and editors can update notes" ON public.notes;
DROP POLICY IF EXISTS "Users can view shares related to them" ON public.note_shares;
DROP POLICY IF EXISTS "Owners can manage shares" ON public.note_shares;
DROP POLICY IF EXISTS "Owners can update shares" ON public.note_shares;
DROP POLICY IF EXISTS "Owners can delete shares" ON public.note_shares;

-- Recreate notes policies without cross-table recursion
CREATE POLICY "View notes (owner or shared)"
ON public.notes FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.is_note_shared_with_me(id));

CREATE POLICY "Update notes (owner or editor)"
ON public.notes FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.can_edit_note(id));

-- Recreate note_shares policies using helper
CREATE POLICY "View own/owner shares"
ON public.note_shares FOR SELECT TO authenticated
USING (shared_with_user_id = auth.uid() OR public.is_note_owner(note_id));

CREATE POLICY "Owners insert shares"
ON public.note_shares FOR INSERT TO authenticated
WITH CHECK (public.is_note_owner(note_id));

CREATE POLICY "Owners update shares"
ON public.note_shares FOR UPDATE TO authenticated
USING (public.is_note_owner(note_id));

CREATE POLICY "Owners delete shares"
ON public.note_shares FOR DELETE TO authenticated
USING (public.is_note_owner(note_id));