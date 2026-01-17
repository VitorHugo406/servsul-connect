-- Fix permissive RLS policy for user_notifications
DROP POLICY IF EXISTS "System can create notifications" ON public.user_notifications;

-- Only admins or the system can create notifications for users
-- Users cannot create notifications for themselves (server-side only via edge functions)
CREATE POLICY "Admins can create notifications"
  ON public.user_notifications FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());