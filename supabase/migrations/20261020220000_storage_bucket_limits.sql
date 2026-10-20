-- Enforce Storage-side limits so uploads are constrained even when clients bypass UI checks.
-- Keep bucket visibility unchanged; these updates only constrain size and MIME type.
UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'text/plain'
    ]
WHERE id = 'attachments';

UPDATE storage.buckets
SET file_size_limit = 1048576,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id = 'avatars';

UPDATE storage.buckets
SET file_size_limit = 1048576,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
WHERE id = 'company-logos';

UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png']
WHERE id = 'face-images';
