import { getCurrentTabUrl } from '@ehentai-helper/shared';
import { GalleryInfo, GalleryTag } from '@ehentai-helper/storage';

import { getDocument } from './htmlStr2Dom';

const getTextContent = (node: Node | null | undefined): string => {
  return node?.textContent || '';
};

/**
 * 提取GalleryInfo
 */
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
    originalFileSizeMB: originalFileSizeMB ? parseFloat(originalFileSizeMB.replace(/(\S+) MB/, '$1')) : 0,
    numImages: numImages ? parseInt(numImages.replace(/(\d+) pages/, '$1')) : 0,
    favorited: favorited ? parseInt(favorited.replace(/(\d+) times/, '$1')) : 0,
    ratingTimes: ratingTimes ? parseInt(ratingTimes) : 0,
    averageScore: averageScore ? parseFloat(averageScore.replace(/Average: (\S+)/, '$1')) : 0.0,
    tags,
  };
  return info;
};

/**
 * 提取GalleryTags
 */
const extractGalleryTags = (htmlOrDoc: string | Document): GalleryTag[] => {
  const doc = getDocument(htmlOrDoc);
  const taglistElements = doc.getElementById('taglist')?.childNodes?.[0]?.childNodes?.[0]?.childNodes;
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

/**
 * 获取页码信息
 */
export const extractGalleryPageInfo = (
  htmlOrDoc: string | Document
): Record<'imagesPerPage' | 'totalImages' | 'numPages', number> => {
  const doc = getDocument(htmlOrDoc);
  const pageInfoStr = doc.querySelector('.gpc')?.innerHTML || '';
  const res = /Showing 1 - (\d+) of (\d*,*\d+) images/.exec(pageInfoStr);
  const pageInfo = {
    imagesPerPage: 0,
    totalImages: 0,
    numPages: 0,
  };
  if (!res) return pageInfo;
  pageInfo.imagesPerPage = +res[1];
  // format 1,100 etc.
  pageInfo.totalImages = +res[2].replace(',', '');
  if (pageInfo.imagesPerPage && pageInfo.totalImages) {
    pageInfo.numPages = Math.ceil(pageInfo.totalImages / pageInfo.imagesPerPage);
  }
  return pageInfo;
};
