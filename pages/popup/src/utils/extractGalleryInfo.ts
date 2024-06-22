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
