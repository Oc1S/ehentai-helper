export const PATTERN_INVALID_FILE_PATH_CHAR = /[:*?"<>|]/g;
export const EXTENSION_NAME = 'E-Hentai Helper';
export const PATTERN_GALLERY_PAGE_URL = /https?:\/\/e[-x]hentai.org\/g\/*/;
export const PATTERN_IMAGE_PAGE_URL = /https?:\/\/e[-x]hentai.org\/s\/*/;

// Default config.
export const DEFAULT_INTERMEDIATE_DOWNLOAD_PATH = 'e-hentai helper/';
export const DEFAULT_SAVE_ORIGINAL_IMAGES = false;
export const DEFAULT_SAVE_GALLERY_INFO = false;
export const DEFAULT_SAVE_GALLERY_TAGS = false;
export const DEFAULT_FILENAME_CONFLICT_ACTION = 'uniquify';
export const DEFAULT_DOWNLOAD_INTERVAL = 300; // In ms.
/**
 * [index] stands for download index
 * [name] stands for original file name
 */
export const DEFAULT_FILE_NAME_RULE = '[index]';

export type Config = typeof defaultConfig;
export const defaultConfig = {
  intermediateDownloadPath: DEFAULT_INTERMEDIATE_DOWNLOAD_PATH,
  saveOriginalImages: DEFAULT_SAVE_ORIGINAL_IMAGES,
  saveGalleryInfo: DEFAULT_SAVE_GALLERY_INFO,
  saveGalleryTags: DEFAULT_SAVE_GALLERY_TAGS,
  filenameConflictAction: DEFAULT_FILENAME_CONFLICT_ACTION,
  downloadInterval: DEFAULT_DOWNLOAD_INTERVAL,
  fileNameRule: DEFAULT_FILE_NAME_RULE,
};
