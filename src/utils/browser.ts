import {
  PATTERN_EHENTAI_PAGE_URL,
  PATTERN_GALLERY_PAGE_URL,
  PATTERN_IMAGE_PAGE_URL,
} from './constant';

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]';
};

export const isEHentaiGalleryUrl = (url: string) => {
  return PATTERN_GALLERY_PAGE_URL.test(url);
};

export const isEHentaiPageUrl = (url: string) => {
  return PATTERN_EHENTAI_PAGE_URL.test(url);
};

export const isEHentaiImagePageUrl = (url: string) => {
  return PATTERN_IMAGE_PAGE_URL.test(url);
};

export const getCurrentTab = () =>
  new Promise<chrome.tabs.Tab>((resolve, reject) => {
    chrome.tabs.query(
      {
        active: true,
        currentWindow: true,
      },
      (tabs) => {
        const [tab] = tabs;
        if (!tab) return reject(new Error('Active tab not found'));
        resolve(tab);
      }
    );
  });

export const getCurrentTabUrl = async (): Promise<string> => {
  const tab = await getCurrentTab();
  if (!tab.url) throw new Error('Active tab url not found');
  return tab.url;
};

/**
 * 从当前激活 tab 中直接抓取 documentElement.outerHTML，
 * 避免再发一次跨域请求拉取同一份页面。
 */
export const getCurrentTabHtml = async (): Promise<string> => {
  const tab = await getCurrentTab();
  if (typeof tab.id !== 'number') throw new Error('Active tab id missing');
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.documentElement.outerHTML,
  });
  return (result?.result as string | undefined) ?? '';
};
