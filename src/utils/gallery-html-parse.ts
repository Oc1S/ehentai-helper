/** Service Worker 可用的 HTML 解析（不依赖 document） */

const normalizeUrl = (href: string) => {
  if (href.startsWith('//')) return `https:${href}`;
  return href;
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

export const extractImageUrlFromPageHtml = (
  html: string,
  saveOriginalImages: boolean
): string | null => {
  const imgMatch = html.match(/id="img"[^>]*\ssrc="([^"]+)"/i);
  if (!imgMatch) return null;

  if (!saveOriginalImages) return imgMatch[1];

  const i6Idx = html.indexOf('id="i6"');
  if (i6Idx === -1) return imgMatch[1];

  const i6Section = html.slice(i6Idx, i6Idx + 4000);
  const linkMatch = i6Section.match(/href="([^"]+)"/i);
  return linkMatch ? normalizeUrl(linkMatch[1]) : imgMatch[1];
};
