import { type GalleryInfo, type GalleryTag } from '@/storage';

import { getCurrentTabUrl } from './browser';
import { getDocument } from './htmlStr2Dom';

/** 画廊页 HTML 特征（排除纯文本错误页、空响应等） */
export const isGalleryPageHtml = (body: unknown): body is string => {
  if (typeof body !== 'string') return false;
  const html = body.trim();
  if (!html || !html.includes('<')) return false;
  return html.includes('id="gn"') && (html.includes('id="gdt"') || html.includes('class="gpc"'));
};

const getTextContent = (node: Node | null | undefined): string => {
  return node?.textContent || '';
};

const normalizeImageUrl = (href: string | null | undefined): string => {
  const url = href?.trim().replace(/^['"]|['"]$/g, '') || '';
  if (!url || url === 'none') return '';
  if (url.startsWith('//')) return `https:${url}`;
  return url;
};

const extractCssUrl = (value: string | null | undefined): string => {
  if (!value) return '';
  const match = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'")]+))\s*\)/i.exec(value);
  return normalizeImageUrl(match?.[1] || match?.[2] || match?.[3]);
};

const extractGalleryCoverUrl = (doc: Document): string => {
  const coverRoot = doc.getElementById('gd1');
  if (!coverRoot) return '';

  const coverImg = coverRoot.querySelector('img');
  const coverImgUrl = normalizeImageUrl(
    coverImg?.getAttribute('src') ||
      coverImg?.getAttribute('data-src') ||
      coverImg?.getAttribute('data-original')
  );
  if (coverImgUrl) return coverImgUrl;

  const styledElements = [
    coverRoot,
    ...Array.from(coverRoot.querySelectorAll<HTMLElement>('[style]')),
  ];
  for (const element of styledElements) {
    const coverUrl = extractCssUrl(
      element.getAttribute('style') || element.style.backgroundImage || element.style.background
    );
    if (coverUrl) return coverUrl;
  }

  return '';
};

export const extractGalleryInfo = async (htmlOrDoc: string | Document): Promise<GalleryInfo> => {
  const doc = getDocument(htmlOrDoc);

  const name = getTextContent(doc.getElementById('gn'));
  const nameInJapanese = getTextContent(doc.getElementById('gj'));
  const category = (doc.getElementById('gdc')?.childNodes?.[0].childNodes?.[0] as any)?.alt || '';
  const uploader = getTextContent(doc.getElementById('gdn')?.childNodes[0]);

  const gdt2ClassElements = doc.getElementsByClassName('gdt2') || [];
  const [posted, parent, visible, language, originalFileSizeMB, numImages, favorited] =
    Array.from(gdt2ClassElements).map(getTextContent);

  const ratingTimes = getTextContent(doc.getElementById('rating_count'));
  const averageScore = getTextContent(doc.getElementById('rating_label'));
  const tags = extractGalleryTags(doc);
  const url = await getCurrentTabUrl().catch(() => '');
  const id = url.split('/').pop() || '';

  const info: GalleryInfo = {
    id,
    name,
    nameInJapanese,
    category,
    uploader,
    posted,
    parent,
    visible,
    language: language ? language.replace(/\s+/, ' ') : '',
    originalFileSizeMB: originalFileSizeMB
      ? parseFloat(originalFileSizeMB.replace(/(\S+) MB/, '$1'))
      : 0,
    numImages: numImages ? parseInt(numImages.replace(/(\d+) pages/, '$1')) : 0,
    favorited: favorited ? parseInt(favorited.replace(/(\d+) times/, '$1')) : 0,
    ratingTimes: ratingTimes ? parseInt(ratingTimes) : 0,
    averageScore: averageScore ? parseFloat(averageScore.replace(/Average: (\S+)/, '$1')) : 0.0,
    tags,
    coverUrl: extractGalleryCoverUrl(doc),
  };
  return info;
};

const extractGalleryTags = (htmlOrDoc: string | Document): GalleryTag[] => {
  const doc = getDocument(htmlOrDoc);
  const taglistElements =
    doc.getElementById('taglist')?.childNodes?.[0]?.childNodes?.[0]?.childNodes;
  if (taglistElements === undefined) return [];
  const tags = new Array(taglistElements.length);
  for (let i = 0; i < taglistElements.length; i++) {
    const tr = taglistElements[i];
    tags[i] = {
      category: tr.childNodes[0].textContent,
      content: '',
    };
    const tagContentElements = tr.childNodes[1].childNodes;
    for (let j = 0; j < tagContentElements.length; j++) {
      if (j > 0) {
        tags[i].content += ', ';
      }
      tags[i].content += tagContentElements[j].textContent;
    }
  }
  return tags;
};

const GPC_PAGE_INFO_PATTERN = /Showing (\d+) - (\d+) of ([\d,]+) images/;

/** EH 账户缩略图设置通常为每页 20 或 40 张 */
const inferImagesPerPage = (start: number, end: number, totalImages: number): number => {
  const rangeCount = end - start + 1;
  if (start === 1) return rangeCount;
  if (end < totalImages) return rangeCount;
  for (const size of [40, 20]) {
    if ((start - 1) % size === 0) return size;
  }
  return rangeCount;
};

const extractTotalImagesFromGdt2 = (doc: Document): number => {
  const gdt2Texts = Array.from(doc.getElementsByClassName('gdt2')).map(getTextContent);
  const lengthText = gdt2Texts[5];
  if (!lengthText) return 0;
  const match = /(\d+) pages/.exec(lengthText);
  return match ? parseInt(match[1], 10) : 0;
};

export const extractGalleryPageInfo = (
  htmlOrDoc: string | Document
): Record<'imagesPerPage' | 'totalImages' | 'numPages', number> => {
  const doc = getDocument(htmlOrDoc);
  const pageInfoStr = doc.querySelector('.gpc')?.innerHTML || '';
  const res = GPC_PAGE_INFO_PATTERN.exec(pageInfoStr);
  const pageInfo = {
    imagesPerPage: 0,
    totalImages: 0,
    numPages: 0,
  };

  if (res) {
    const start = +res[1];
    const end = +res[2];
    pageInfo.totalImages = +res[3].replace(/,/g, '');
    pageInfo.imagesPerPage = inferImagesPerPage(start, end, pageInfo.totalImages);
  } else {
    pageInfo.totalImages = extractTotalImagesFromGdt2(doc);
  }

  if (pageInfo.imagesPerPage && pageInfo.totalImages) {
    pageInfo.numPages = Math.ceil(pageInfo.totalImages / pageInfo.imagesPerPage);
  }
  return pageInfo;
};
