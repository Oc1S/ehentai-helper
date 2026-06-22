import type { Config } from './constant';
import { splitFilename } from './download';

export const buildImageEntryName = (
  config: Config,
  index: number,
  total: number,
  sourceUrl: string,
  ext: string
): string => {
  const urlName = (() => {
    try {
      const path = new URL(sourceUrl).pathname;
      const base = path.split('/').pop() ?? 'image';
      return splitFilename(base)[0];
    } catch {
      return 'image';
    }
  })();

  return `${config.fileNameRule
    .replace('[index]', String(index))
    .replace('[name]', urlName)
    .replace('[total]', String(total))}.${ext}`;
};
