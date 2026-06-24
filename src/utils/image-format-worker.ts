import type { ImageFormat } from './constant';
import { assertBlobNotHtml, assertResponseNotHtml } from './image-response-guard';

const MIME_MAP: Record<Exclude<ImageFormat, 'original'>, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Background / Service Worker 内图片格式转换（OffscreenCanvas） */
export const convertImageToFormatInWorker = async (
  sourceUrl: string,
  format: Exclude<ImageFormat, 'original'>
): Promise<Blob> => {
  const response = await fetch(sourceUrl, { credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status})`);
  }
  assertResponseNotHtml(response);
  const blob = await response.blob();
  await assertBlobNotHtml(blob);
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Failed to acquire 2d canvas context');
  }
  if (format === 'jpg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  return canvas.convertToBlob({
    type: MIME_MAP[format],
    quality: format === 'png' ? undefined : 0.92,
  });
};
