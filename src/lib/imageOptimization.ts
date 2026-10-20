export async function optimizeImageFile(file: File, maxDimension = 1600): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 350 * 1024) { bitmap.close(); return file; }
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
    const context = canvas.getContext('2d');
    if (!context) { bitmap.close(); return file; }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
    if (blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp', lastModified: Date.now() });
  } catch { return file; }
}
