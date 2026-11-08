-- Animated stickers (up to 5 s, like WhatsApp) are GIFs. They keep the same content-addressed
-- key as static stickers (<company_id>/<sha256>.webp, so favorites/packs/messages are unchanged);
-- the real type (image/gif) is stored on the object and browsers play it by content.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/webp', 'image/png', 'image/gif'],
    file_size_limit = 1500000
WHERE id = 'stickers';
