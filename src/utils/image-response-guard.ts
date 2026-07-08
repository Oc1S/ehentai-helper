import { authFetch } from './auth-fetch';
import { extractHtmlErrorMessage } from './html-error-parse';

const HTML_RESPONSE_FALLBACK = 'Server returned HTML instead of image';

const looksLikeHtml = (sample: string) => /^\s*(?:<!DOCTYPE\s+html|<html\b)/i.test(sample);

const throwHtmlResponseError = (html: string): never => {
  const detail = extractHtmlErrorMessage(html);
  throw new Error(detail ?? HTML_RESPONSE_FALLBACK);
};

export const assertBlobNotHtml = async (blob: Blob): Promise<void> => {
  if (blob.size === 0) return;

  const isHtmlMime = /text\/html/i.test(blob.type);
  const peekSize = Math.min(4096, blob.size);
  const peek = await blob.slice(0, peekSize).text();
  const isHtmlBody = isHtmlMime || looksLikeHtml(peek);

  if (!isHtmlBody) return;

  const html = peekSize >= blob.size ? peek : await blob.text();
  throwHtmlResponseError(html);
};

/** 请求图片 URL 并校验响应体不是 HTML（用于直链下载前探测） */
export const probeImageUrl = async (sourceUrl: string): Promise<void> => {
  const res = await authFetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const blob = await res.blob();
  await assertBlobNotHtml(blob);
};
