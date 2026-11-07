-- Chat stickers (WhatsApp-like). A sticker is a 512x512 WebP stored ONCE per company,
-- named by the SHA-256 of its bytes (stickers/<company_id>/<sha256>.webp). Sending it
-- again only sends a reference in the message ("✨ sticker:<company_id>/<sha256>"),
-- devices cache the file, and identical uploads collapse into the same object.
-- Stickers are not chat media, so the 7-day attachment cleanup never touches them.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('stickers', 'stickers', false, 300000, ARRAY['image/webp', 'image/png'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Company reads stickers" ON storage.objects;
CREATE POLICY "Company reads stickers" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stickers' AND (storage.foldername(name))[1] = public.current_company_id()::text);
DROP POLICY IF EXISTS "Company uploads stickers" ON storage.objects;
CREATE POLICY "Company uploads stickers" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stickers' AND (storage.foldername(name))[1] = public.current_company_id()::text
              AND name ~ '^[0-9a-f-]{36}/[0-9a-f]{64}\.webp$');
-- No UPDATE/DELETE: content-addressed files are immutable and shared.

-- Personal sticker collection ("Minhas figurinhas"), synced across devices.
CREATE TABLE IF NOT EXISTS public.chat_sticker_favorites (
  profile_id uuid NOT NULL DEFAULT public.get_current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, sha256)
);
ALTER TABLE public.chat_sticker_favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own sticker favorites" ON public.chat_sticker_favorites;
CREATE POLICY "Own sticker favorites" ON public.chat_sticker_favorites FOR ALL TO authenticated
  USING (profile_id = public.get_current_profile_id())
  WITH CHECK (profile_id = public.get_current_profile_id() AND company_id = public.current_company_id());
