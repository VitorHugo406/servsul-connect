-- Metadata for temporary chat-file copies. This migration does not change
-- bucket visibility or existing upload behavior; those changes must ship together
-- with the authorized download endpoint and client integration.
CREATE TABLE IF NOT EXISTS public.attachment_lifecycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_bucket text NOT NULL DEFAULT 'attachments'
    CHECK (storage_bucket = 'attachments'),
  storage_path text NOT NULL UNIQUE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  temporary_expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  temporary_deleted_at timestamptz,
  sender_device_id uuid,
  original_available boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'temporary'
    CHECK (status IN ('temporary', 'expired', 'original_unavailable', 'deleted')),
  CHECK (temporary_expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS attachment_lifecycle_expiry_idx
  ON public.attachment_lifecycle (temporary_expires_at)
  WHERE temporary_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS attachment_lifecycle_sender_idx
  ON public.attachment_lifecycle (uploaded_by, created_at DESC);

ALTER TABLE public.attachment_lifecycle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Senders can view their attachment lifecycle metadata"
  ON public.attachment_lifecycle;
CREATE POLICY "Senders can view their attachment lifecycle metadata"
  ON public.attachment_lifecycle
  FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid());

-- Writes and lifecycle transitions are reserved for trusted server-side code
-- using the service role. Do not add client INSERT/UPDATE policies here.
REVOKE ALL ON public.attachment_lifecycle FROM anon, authenticated;
GRANT SELECT ON public.attachment_lifecycle TO authenticated;
