-- Attachment lifecycle metadata for temporary server copies.
-- This migration intentionally does not change bucket visibility or existing
-- storage policies: those changes require a verified download authorization flow.
CREATE TABLE IF NOT EXISTS public.attachment_lifecycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_bucket text NOT NULL DEFAULT 'attachments'
    CHECK (storage_bucket = 'attachments'),
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'temporary'
    CHECK (status IN ('temporary', 'expired', 'saved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  temporary_expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  temporary_deleted_at timestamptz,
  UNIQUE (storage_bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS attachment_lifecycle_expiry_idx
  ON public.attachment_lifecycle (temporary_expires_at)
  WHERE status = 'temporary' AND temporary_deleted_at IS NULL;

ALTER TABLE public.attachment_lifecycle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own attachment lifecycle"
  ON public.attachment_lifecycle;
CREATE POLICY "Users can view own attachment lifecycle"
  ON public.attachment_lifecycle
  FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid());

-- Writes are performed only by the authenticated registration Edge Function
-- using the service role key. Cleanup also uses the service role key.
REVOKE ALL ON public.attachment_lifecycle FROM anon, authenticated;
GRANT SELECT ON public.attachment_lifecycle TO authenticated;
GRANT ALL ON public.attachment_lifecycle TO service_role;
