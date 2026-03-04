-- Allow any authenticated user to insert notifications (for @mentions)
CREATE POLICY "Authenticated users can create mention notifications"
ON public.user_notifications
FOR INSERT
TO authenticated
WITH CHECK (true);