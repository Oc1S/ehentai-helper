import type { ImageFormat } from './constant';
import { convertImageToFormatInWorker } from './image-format-worker';
import { assertBlobNotHtml, assertResponseNotHtml } from './image-response-guard';

export { probeImageUrl } from './image-response-guard';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const extFromUrl = (url: string): string => {
  try {
    const path = new URL(url).pathname;
    const dot = path.lastIndexOf('.');
    if (dot === -1) return 'jpg';
    const ext = path.slice(dot + 1).toLowerCase();
    return ext || 'jpg';
  } catch {
    return 'jpg';
  }
};

/** 抓取并（可选）转码，返回用于落盘或 CBZ 缓存的 Blob */
export const resolveImageBlob = async (
  sourceUrl: string,
  format: ImageFormat
): Promise<{ blob: Blob; ext: string }> => {
  if (!format || format === 'original') {
    const res = await fetch(sourceUrl, { credentials: 'omit' });
    if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
    assertResponseNotHtml(res);
    const blob = await res.blob();
    await assertBlobNotHtml(blob);
    return { blob, ext: MIME_EXT[blob.type] ?? extFromUrl(sourceUrl) };
  }

  const blob = await convertImageToFormatInWorker(sourceUrl, format);
  return { blob, ext: format };
};
