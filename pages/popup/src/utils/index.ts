const PATTERN_INVALID_FILENAME_CHAR = /[\\/:*?"<>|.~]/g;

export const removeInvalidCharFromFilename = (filename: string) => {
  return filename.replace(PATTERN_INVALID_FILENAME_CHAR, ' ').replace(/\s+$/, '');
};

export const downloadAsTxtFile = (text: string) => {
  chrome.downloads.download({
    url: 'data:text;charset=utf-8,' + encodeURI(text),
  });
};

export * from './extractor';
export * from './htmlStr2Dom';
