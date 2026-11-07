-- Read receipts in groups (blue ticks): returns the moment up to which ALL other members
-- have read the group. Exposes no per-person data; only group members can call it.
CREATE OR REPLACE FUNCTION public.group_read_watermark(_group_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.is_group_member(_group_id) THEN (
    SELECT min(COALESCE(r.last_read_at, 'epoch'::timestamptz))
    FROM public.private_group_members m
    LEFT JOIN public.private_group_message_reads r ON r.group_id = m.group_id AND r.user_id = m.user_id
    WHERE m.group_id = _group_id AND m.user_id <> auth.uid()
  ) END
$$;
REVOKE ALL ON FUNCTION public.group_read_watermark(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.group_read_watermark(uuid) TO authenticated;
