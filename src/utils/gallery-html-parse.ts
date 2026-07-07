/** Service Worker 可用的 HTML 解析（不依赖 document） */
const decodeHtmlUrl = (href: string) => href.replace(/&amp;/gi, '&').replace(/&#38;/gi, '&').trim();

const normalizeUrl = (href: string) => {
  const decoded = decodeHtmlUrl(href);
  if (decoded.startsWith('//')) return `https:${decoded}`;
  return decoded;
};

export type ImageUrlSource = 'preview' | 'i6' | 'fullimg';

export type ParsedImageUrl = {
  url: string;
  source: ImageUrlSource;
};

export const extractImagePageUrlsFromHtml = (html: string): string[] => {
  const gdtIdx = html.indexOf('id="gdt"');
  if (gdtIdx === -1) return [];

  const section = html.slice(gdtIdx, gdtIdx + 120_000);
  const urls: string[] = [];
  const re = /<a[^>]+href="([^"]+)"/gi;
  let match = re.exec(section);
  while (match) {
    urls.push(normalizeUrl(match[1]));
    match = re.exec(section);
  }
  return urls;
};

/** `#img` 展示图 — 不勾选原图时始终使用；原图解析失败时也可回退到此 */
export const extractPreviewImageUrl = (html: string): string | null => {
  const imgMatch = html.match(/id="img"[^>]*\ssrc="([^"]+)"/i);
  return imgMatch ? normalizeUrl(imgMatch[1]) : null;
};

/** `/fullimg/...` 或 `fullimg.php?...` — EH 当前常见的原图入口 */
const extractFullimgUrl = (html: string): string | null => {
  const fullimgPath = html.match(/href="(https?:\/\/[^"]+\/fullimg\/[^"]+)"/i);
  if (fullimgPath) return normalizeUrl(fullimgPath[1]);

  const fullimgPhp = html.match(/href="(https?:\/\/[^"]+fullimg\.php[^"]+)"/i);
  if (fullimgPhp) return normalizeUrl(fullimgPhp[1]);

  return null;
};

const IMAGE_FILE_RE = /\.(?:avif|bmp|gif|jpe?g|jfif|png|webp)(?:[?#]|$)/i;

const isLikelyImageResourceUrl = (url: string) => {
  if (/[?&](?:f_shash|fs_from)=/i.test(url)) return false;
  if (/\/fullimg(?:\/|\?)|fullimg\.php/i.test(url)) return true;
  if (!IMAGE_FILE_RE.test(url)) return false;

  try {
    const parsed = new URL(url);
    if (/e[-x]hentai\.org$/i.test(parsed.hostname)) return false;
    return true;
  } catch {
    return true;
  }
};

/** `#i6` 区块内可能有图片直链，也可能是相似图片搜索链接；只接受明确图片资源 */
const extractI6Url = (html: string): string | null => {
  const i6Idx = html.indexOf('id="i6"');
  if (i6Idx === -1) return null;

  const i6Section = html.slice(i6Idx, i6Idx + 8000);
  const linkRe = /href=(?:"([^"]+)"|'([^']+)')/gi;
  let match = linkRe.exec(i6Section);
  while (match) {
    const url = normalizeUrl(match[1] || match[2]);
    if (isLikelyImageResourceUrl(url)) return url;
    match = linkRe.exec(i6Section);
  }
  return null;
};

/** 原图 URL 追加 nl，尽量从常规图床拉取（EH 社区下载器通用做法） */
export const appendNlIfNeeded = (url: string): string => {
  if (!/\/fullimg(?:\/|\?)/i.test(url)) return url;
  if (/[?&]nl(?:=|&|$)/.test(url)) return url;
  return url.includes('?') ? `${url}&nl` : `${url}?nl`;
};

const appendQueryParam = (url: string, key: string, value: string): string => {
  const hashIndex = url.indexOf('#');
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${key}=${encodeURIComponent(value)}${hash}`;
};

export const appendImagePageNlIfNeeded = (url: string, nl: string): string => {
  const normalizedUrl = normalizeUrl(url);
  const token = nl.trim();
  if (!token || /[?&]nl=/.test(normalizedUrl)) return normalizedUrl;
  return appendQueryParam(normalizedUrl, 'nl', token);
};

const extractNlToken = (html: string): string | null => {
  const queryMatch = html.match(/[?&]nl=([A-Za-z0-9_-]+)/i);
  if (queryMatch?.[1]) return queryMatch[1];

  const callMatch = html.match(/\bnl\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (callMatch?.[1]) return callMatch[1];

  const valueMatch = html.match(/\bnl['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
  return valueMatch?.[1] ?? null;
};

export const extractImagePageNlReloadUrl = (html: string, currentUrl: string): string | null => {
  const imagePageUrlRe =
    /https?:\/\/[^"'<>\s]+\/s\/[^"'<>\s?/#]+\/[^"'<>\s?/#]+(?:\?[^"'<>\s#]*)?/gi;

  let match = imagePageUrlRe.exec(html);
  while (match) {
    const url = normalizeUrl(match[0]);
    if (/[?&]nl=/.test(url)) return url;
    match = imagePageUrlRe.exec(html);
  }

  const token = extractNlToken(html);
  return token ? appendImagePageNlIfNeeded(currentUrl, token) : null;
};

const resolveOriginalUrl = (html: string): { url: string; source: ImageUrlSource } | null => {
  const fullimg = extractFullimgUrl(html);
  if (fullimg) {
    return { url: appendNlIfNeeded(fullimg), source: 'fullimg' };
  }

  const i6 = extractI6Url(html);
  if (i6) {
    return { url: appendNlIfNeeded(i6), source: 'i6' };
  }
  return null;
};

export const extractImageUrlFromPageHtml = (
  html: string,
  saveOriginalImages: boolean
): ParsedImageUrl | null => {
  const preview = extractPreviewImageUrl(html);
  if (!preview) return null;

  if (!saveOriginalImages) {
    return { url: preview, source: 'preview' };
  }

  const original = resolveOriginalUrl(html);
  if (original) return original;

  return { url: preview, source: 'preview' };
};
