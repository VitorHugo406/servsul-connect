-- Fix infinite recursion in private_group_members policies
-- Drop all existing policies on private_group_members
DROP POLICY IF EXISTS "Members can view group members" ON private_group_members;
DROP POLICY IF EXISTS "Admins can add members" ON private_group_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON private_group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON private_group_members;

-- Create a function to check if user is a group member without recursion
CREATE OR REPLACE FUNCTION is_group_member(check_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM private_group_members
    WHERE group_id = check_group_id AND user_id = auth.uid()
  );
$$;

-- Create a function to check if user is a group admin without recursion
CREATE OR REPLACE FUNCTION is_group_admin(check_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM private_group_members
    WHERE group_id = check_group_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Create a function to check if a group has no members (for first member insertion)
CREATE OR REPLACE FUNCTION is_group_empty(check_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM private_group_members WHERE group_id = check_group_id
  );
$$;

-- Recreate policies without recursion using the new functions
CREATE POLICY "Members can view group members" ON private_group_members
  FOR SELECT USING (is_group_member(group_id));

CREATE POLICY "Admins can add members" ON private_group_members
  FOR INSERT WITH CHECK (
    is_group_admin(group_id) OR 
    (user_id = auth.uid() AND is_group_empty(group_id))
  );

CREATE POLICY "Admins can update member roles" ON private_group_members
  FOR UPDATE USING (is_group_admin(group_id));

CREATE POLICY "Group admins can remove members" ON private_group_members
  FOR DELETE USING (is_group_admin(group_id) OR user_id = auth.uid());

-- Also fix private_groups policies to avoid recursion
DROP POLICY IF EXISTS "Members can view their groups" ON private_groups;
DROP POLICY IF EXISTS "Group admins can update their groups" ON private_groups;
DROP POLICY IF EXISTS "Group admins can delete their groups" ON private_groups;

-- Function to check if user is member of a group by group id
CREATE OR REPLACE FUNCTION user_is_member_of_group(check_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM private_group_members
    WHERE group_id = check_group_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY "Members can view their groups" ON private_groups
  FOR SELECT USING (user_is_member_of_group(id) OR created_by = auth.uid());

CREATE POLICY "Group admins can update their groups" ON private_groups
  FOR UPDATE USING (is_group_admin(id));

CREATE POLICY "Group admins can delete their groups" ON private_groups
  FOR DELETE USING (is_group_admin(id));