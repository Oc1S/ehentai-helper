export const htmlStr2DOM = (html: string, title = '') => {
  const doc = document.implementation.createHTMLDocument(title);
  doc.documentElement.innerHTML = html;
  return doc;
};
