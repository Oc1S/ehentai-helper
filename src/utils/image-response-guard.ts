import { authFetch } from './auth-fetch';

const HTML_RESPONSE_ERROR = 'Server returned HTML instead of image';

export const assertResponseNotHtml = (response: Response): void => {
  const contentType = response.headers.get('content-type') ?? '';
  if (/text\/html/i.test(contentType)) {
    throw new Error(HTML_RESPONSE_ERROR);
  }
};

export const assertBlobNotHtml = async (blob: Blob): Promise<void> => {
  if (/text\/html/i.test(blob.type)) {
    throw new Error(HTML_RESPONSE_ERROR);
  }
  if (blob.size === 0) return;

  const sample = await blob.slice(0, Math.min(512, blob.size)).text();
  if (/^\s*(?:<!DOCTYPE\s+html|<html\b)/i.test(sample)) {
    throw new Error(HTML_RESPONSE_ERROR);
  }
};

/** 请求图片 URL 并校验响应体不是 HTML（用于直链下载前探测） */
export const probeImageUrl = async (sourceUrl: string): Promise<void> => {
  const res = await authFetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  assertResponseNotHtml(res);
  const blob = await res.blob();
  await assertBlobNotHtml(blob);
};
