-- Allow group admins to delete group messages
CREATE POLICY "Group admins can delete messages"
ON public.private_group_messages
FOR DELETE
USING (is_group_admin(group_id));

-- Allow group admins to delete message reads
CREATE POLICY "Group admins can delete message reads"
ON public.private_group_message_reads
FOR DELETE
USING (is_group_admin(group_id));
