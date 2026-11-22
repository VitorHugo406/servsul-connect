-- Vídeos de celular Android (3GP) e M4V também podem ir para os avisos; fotos em HEIC/BMP são convertidas para JPEG
-- no navegador antes do envio, então a lista de imagens continua a mesma.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp', 'video/x-m4v']
where id = 'announcement-media';
