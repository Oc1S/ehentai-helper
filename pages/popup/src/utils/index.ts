const PATTERN_INVALID_FILENAME_CHAR = /[\\/:*?"<>|.~]/g;

export const removeInvalidCharFromFilename = (filename: string) => {
  return filename.replace(PATTERN_INVALID_FILENAME_CHAR, ' ').replace(/\s+$/, '');
};

export const generateTxtFile = (text: string) => {
  chrome.downloads.download({
    url: 'data:text;charset=utf-8,' + encodeURI(text),
  });
};
