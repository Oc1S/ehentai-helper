export const htmlStr2DOM = (html: string): Document => {
  const doc = document.implementation.createHTMLDocument('');
  doc.documentElement.innerHTML = html;
  return doc;
};

export const getDocument = (htmlOrDoc: string | Document): Document => {
  return typeof htmlOrDoc === 'string' ? htmlStr2DOM(htmlOrDoc) : htmlOrDoc;
};
