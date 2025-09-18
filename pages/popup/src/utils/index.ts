const PATTERN_INVALID_FILENAME_CHAR = /[\\/:*?"<>|.~]/g;

export const removeInvalidCharFromFilename = (filename: string) => {
  return filename.replace(PATTERN_INVALID_FILENAME_CHAR, ' ').replace(/\s+$/, '');
};

export const downloadAsTxtFile = (text: string) => {
  chrome.downloads.download({
    url: 'data:text;charset=utf-8,' + encodeURI(text),
    filename: 'info.json',
  });
};

export const splitFilename = (fileFullname: string) => {
  const lastIndexOfDot = fileFullname.lastIndexOf('.');
  if (lastIndexOfDot === -1) {
    return [fileFullname, ''];
  }
  const name = fileFullname.substring(0, lastIndexOfDot);
  const fileType = fileFullname.substring(lastIndexOfDot + 1);
  return [name, fileType];
};

export * from './extractor';
export * from './htmlStr2Dom';
