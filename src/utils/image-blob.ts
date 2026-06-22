import type { ImageFormat } from './constant';
import { convertImageToFormatInWorker } from './image-format-worker';

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
    const blob = await res.blob();
    return { blob, ext: MIME_EXT[blob.type] ?? extFromUrl(sourceUrl) };
  }

  const objectUrl = await convertImageToFormatInWorker(sourceUrl, format);
  try {
    const res = await fetch(objectUrl);
    const blob = await res.blob();
    return { blob, ext: format };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
