-- Swipe-to-reply (mobile, WhatsApp-like): direct and group messages can point to the message
-- they answer, like the sector chat already does with messages.reply_to_id.
-- Same table only (a reply never crosses conversations); deleting the original keeps the reply.
-- No RLS change: the column lives in rows each person can already read/insert.
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL;
ALTER TABLE public.private_group_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.private_group_messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS direct_messages_reply_to_idx ON public.direct_messages (reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS private_group_messages_reply_to_idx ON public.private_group_messages (reply_to_id) WHERE reply_to_id IS NOT NULL;
