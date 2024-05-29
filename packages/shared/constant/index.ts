export const PATTERN_INVALID_FILE_PATH_CHAR = /[:*?"<>|]/g;
export const STATUS_SHOWING_DURATION = 3_000; // In ms.

// Default config.
export const DEFAULT_INTERMEDIATE_DOWNLOAD_PATH = 'e-hentai helper/';
export const DEFAULT_SAVE_ORIGINAL_IMAGES = false;
export const DEFAULT_SAVE_GALLERY_INFO = false;
export const DEFAULT_SAVE_GALLERY_TAGS = false;
export const DEFAULT_FILENAME_CONFLICT_ACTION = 'uniquify';
export const DEFAULT_DOWNLOAD_INTERVAL = 300; // In ms.

const defaultConfig = {
  intermediateDownloadPath: DEFAULT_INTERMEDIATE_DOWNLOAD_PATH,
  saveOriginalImages: DEFAULT_SAVE_ORIGINAL_IMAGES,
  saveGalleryInfo: DEFAULT_SAVE_GALLERY_INFO,
  saveGalleryTags: DEFAULT_SAVE_GALLERY_TAGS,
  filenameConflictAction: DEFAULT_FILENAME_CONFLICT_ACTION,
  downloadInterval: DEFAULT_DOWNLOAD_INTERVAL,
};
