import { htmlStr2DOM } from './htmlStr2Dom';

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
