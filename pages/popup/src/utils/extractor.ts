import { htmlStr2DOM } from './htmlStr2Dom';

/**
 * 提取GalleryInfo
 */
export const extractGalleryInfo = (html: string) => {
  const doc = htmlStr2DOM(html);
  const extractTextContent = (node: Node | null | undefined) => {
    return node?.textContent || '';
  };
  const name = extractTextContent(doc.getElementById('gn'));
  const nameInJapanese = extractTextContent(doc.getElementById('gj'));
  const category = (doc.getElementById('gdc')?.childNodes?.[0].childNodes?.[0] as any)?.alt || '';
  const uploader = extractTextContent(doc.getElementById('gdn')?.childNodes[0]);

  const gdt2ClassElements = doc.getElementsByClassName('gdt2') || [];
  const [posted, parent, visible, language, originalFileSizeMB, numImages, favorited] =
    Array.from(gdt2ClassElements).map(extractTextContent);

  const ratingTimes = extractTextContent(doc.getElementById('rating_count'));
  const averageScore = extractTextContent(doc.getElementById('rating_label'));

  const info: Record<string, any> = {
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
  };
  return info;
};

/**
 * 提取GalleryTags
 */
export const extractGalleryTags = (html: string) => {
  const doc = htmlStr2DOM(html);
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
export const extractGalleryPageInfo = (html: string): Record<'imagesPerPage' | 'totalImages' | 'numPages', number> => {
  const doc = htmlStr2DOM(html);
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
