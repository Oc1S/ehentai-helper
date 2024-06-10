import { PATTERN_GALLERY_PAGE_URL } from '@/constant';
/** chrome插件 - 获取当前tabUrl */
export const getCurrentTabUrl = () =>
  new Promise<string>((resolve, reject) => {
    chrome.tabs.query(
      {
        active: true,
        currentWindow: true,
      },
      tabs => {
        const [tab] = tabs;
        const { url } = tab;
        if (!url) return reject();
        resolve(url);
      }
    );
  });

export const isEHentaiUrl = (url: string) => {
  return PATTERN_GALLERY_PAGE_URL.test(url);
};
