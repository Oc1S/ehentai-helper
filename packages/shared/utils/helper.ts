import { PATTERN_GALLERY_PAGE_URL } from '@/constant';

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]';
};

export const isEHentaiUrl = (url: string) => {
  return PATTERN_GALLERY_PAGE_URL.test(url);
};
