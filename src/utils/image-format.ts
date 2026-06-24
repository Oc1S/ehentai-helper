import type { ImageFormat } from './constant';
import { assertBlobNotHtml, assertResponseNotHtml } from './image-response-guard';

const MIME_MAP: Record<Exclude<ImageFormat, 'original'>, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * 将原始图片 URL 转换为指定格式的 ObjectURL。
 * 调用方在 chrome.downloads.download 完成后需手动 revoke。
 */
export const convertImageToFormat = async (
  sourceUrl: string,
  format: Exclude<ImageFormat, 'original'>
): Promise<string> => {
  const response = await fetch(sourceUrl, { credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status})`);
  }
  assertResponseNotHtml(response);
  const blob = await response.blob();
  await assertBlobNotHtml(blob);

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('Failed to acquire 2d canvas context');
  }
  if (format === 'jpg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const targetBlob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('canvas.toBlob returned null'));
      },
      MIME_MAP[format],
      format === 'png' ? undefined : 0.92
    );
  });

  return URL.createObjectURL(targetBlob);
};

/** 在下载完成/失败后释放转换产生的 ObjectURL */
export const releaseConvertedUrlOnDownloadDone = (
  chromeDownloadId: number,
  objectUrl: string
): void => {
  const onChanged = (delta: chrome.downloads.DownloadDelta) => {
    if (delta.id !== chromeDownloadId) return;
    const next = delta.state?.current;
    if (next === 'complete' || next === 'interrupted') {
      URL.revokeObjectURL(objectUrl);
      chrome.downloads.onChanged.removeListener(onChanged);
    }
  };
  chrome.downloads.onChanged.addListener(onChanged);
};
