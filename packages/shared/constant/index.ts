export const PATTERN_INVALID_FILE_PATH_CHAR = /[:*?"<>|]/g;
export const EXTENSION_NAME = 'E-Hentai Helper';
export const PATTERN_EHENTAI_PAGE_URL = /https?:\/\/e[-x]hentai.org\/*/;
export const PATTERN_GALLERY_PAGE_URL = /https?:\/\/e[-x]hentai.org\/g\/*/;
export const PATTERN_IMAGE_PAGE_URL = /https?:\/\/e[-x]hentai.org\/s\/*/;

export type Config = typeof defaultConfig;
export const defaultConfig = {
  intermediateDownloadPath: 'e-hentai helper/',
  saveOriginalImages: false,
  saveGalleryInfo: false,
  filenameConflictAction: 'uniquify',
  downloadInterval: 300,
  /**
   * [index] stands for download index
   * [name] stands for original file name
   */
  fileNameRule: '[index]',
};
