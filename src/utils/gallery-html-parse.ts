/** Service Worker 可用的 HTML 解析（不依赖 document） */

const normalizeUrl = (href: string) => {
  if (href.startsWith('//')) return `https:${href}`;
  return href;
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

/** `#i6` 区块内第一个链接 — 旧版/部分页面仍走此结构 */
const extractI6Url = (html: string): string | null => {
  const i6Idx = html.indexOf('id="i6"');
  if (i6Idx === -1) return null;

  const i6Section = html.slice(i6Idx, i6Idx + 8000);
  const linkMatch = i6Section.match(/href="([^"]+)"/i);
  return linkMatch ? normalizeUrl(linkMatch[1]) : null;
};

/** 原图 URL 追加 nl，尽量从常规图床拉取（EH 社区下载器通用做法） */
export const appendNlIfNeeded = (url: string): string => {
  if (!/\/fullimg(?:\/|\?)/i.test(url)) return url;
  if (/[?&]nl(?:=|&|$)/.test(url)) return url;
  return url.includes('?') ? `${url}&nl` : `${url}?nl`;
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
