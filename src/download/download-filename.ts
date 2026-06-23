import type { Config } from '@/utils';
import { splitFilename } from '@/utils';

export type PendingDownloadFilename = {
  downloadPath: string;
  index: number;
  total: number;
  ext: string;
  sourceUrl: string;
};

const pendingQueue: PendingDownloadFilename[] = [];

export const enqueuePendingDownloadFilename = (item: PendingDownloadFilename) => {
  pendingQueue.push(item);
};

export const consumePendingDownloadFilename = () => pendingQueue.shift();

export const normalizeDownloadDir = (path: string) => {
  const normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/');
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
};

export const safeFileExtension = (ext: string) => {
  const cleaned = ext.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return cleaned || 'jpg';
};

const nameFromSourceUrl = (sourceUrl: string) => {
  try {
    const base = new URL(sourceUrl).pathname.split('/').pop() ?? 'image';
    return splitFilename(base)[0] || 'image';
  } catch {
    return 'image';
  }
};

export const buildStorageRelativeFilename = (
  config: Pick<Config, 'fileNameRule'>,
  hint: PendingDownloadFilename
): string => {
  const dir = normalizeDownloadDir(hint.downloadPath);
  const name = nameFromSourceUrl(hint.sourceUrl);
  const ext = safeFileExtension(hint.ext);
  const base = config.fileNameRule
    .replace('[index]', String(hint.index))
    .replace('[name]', name)
    .replace('[total]', String(hint.total));
  return `${dir}${base}.${ext}`;
};

export const extensionFromDownloadItem = (
  downloadItem: chrome.downloads.DownloadItem,
  overrideExt: string | null
): string => {
  if (overrideExt) return safeFileExtension(overrideExt);
  const url = downloadItem.url ?? downloadItem.finalUrl ?? '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return 'jpg';

  const [, fromName] = splitFilename(downloadItem.filename ?? '');
  if (fromName && /^[a-z0-9]+$/i.test(fromName)) {
    return safeFileExtension(fromName);
  }
  return 'jpg';
};
