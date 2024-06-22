import { PATTERN_EHENTAI_PAGE_URL, PATTERN_GALLERY_PAGE_URL } from '@/constant';

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]';
};

export const isEHentaiGalleryUrl = (url: string) => {
  return PATTERN_GALLERY_PAGE_URL.test(url);
};

export const isEHentaiPageUrl = (url: string) => {
  return PATTERN_EHENTAI_PAGE_URL.test(url);
};
