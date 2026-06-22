const fallbackMessages: Record<string, string> = {
  startDownload: 'Start Download',
  confirmDownload: 'Confirm Download',
  cancel: 'Cancel',
  continueMissing: 'Continue missing',
  redownloadAll: 'Redownload all',
  retryFailed: 'Retry failed',
  openFolder: 'Open download folder',
  downloadAgain: 'Download again',
  refreshPage: 'Refresh',
  clearAll: 'Clear All',
  delete: 'Delete',
  confirmClearAll: 'Clear all history and gallery records?',
  confirmDelete: 'Delete this history entry and gallery record?',
  confirmDownloadBody: 'images · range',
  estimatedTime: 'Estimated',
  seconds: 's',
  viewFileList: 'View file list',
  downloadsTab: 'Downloads',
  backgroundHint: 'You can close this popup — download continues in the background.',
  pathPreviewExample: 'Gallery Name/',
  settings: 'Settings',
  saveSettings: 'Save Settings',
  historyTab: 'History',
  infoTab: 'Info',
  previouslyTracked: 'Previously tracked',
  viewDetails: 'View details',
  downloadCancelled: 'Download cancelled',
  partialSuccessToast: '$1 succeeded, $2 failed',
  downloadFailedToast: 'Download failed ($1 errors)',
  storageLimitHint:
    'History keeps the latest $1 of $2 entries · Gallery tracking keeps $3 of $4 galleries. Older records are removed automatically.',
  outputModeFiles: 'Individual files',
  outputModeCbz: 'CBZ only',
  outputModeBoth: 'Both',
};

export type I18nKey = keyof typeof fallbackMessages;

export const t = (key: I18nKey, substitutions?: string | string[]): string => {
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
      const message = chrome.i18n.getMessage(key, substitutions);
      if (message) return message;
    }
  } catch {
    /* dev / non-extension context */
  }

  const template = fallbackMessages[key] ?? key;
  if (!substitutions) return template;

  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  return values.reduce((result, value, index) => result.replace(`$${index + 1}`, value), template);
};
