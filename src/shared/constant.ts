export const PATTERN_INVALID_FILE_PATH_CHAR = /[:*?"<>|]/;
export const EXTENSION_NAME = 'E-Hentai Helper';
export const PATTERN_EHENTAI_PAGE_URL = /https?:\/\/e[-x]hentai.org\/*/;
export const PATTERN_GALLERY_PAGE_URL = /https?:\/\/e[-x]hentai.org\/g\/*/;
export const PATTERN_IMAGE_PAGE_URL = /https?:\/\/e[-x]hentai.org\/s\/*/;

export type ImageFormat = 'original' | 'jpg' | 'png' | 'webp';

export type Config = {
  intermediateDownloadPath: string;
  saveOriginalImages: boolean;
  saveGalleryInfo: boolean;
  filenameConflictAction: chrome.downloads.FilenameConflictAction;
  downloadInterval: number;
  fileNameRule: string;
  imageFormat: ImageFormat;
};

export const defaultConfig: Config = {
  intermediateDownloadPath: 'e-hentai helper/',
  saveOriginalImages: false,
  saveGalleryInfo: false,
  filenameConflictAction: 'uniquify',
  downloadInterval: 300,
  fileNameRule: '[index]',
  imageFormat: 'original',
};
