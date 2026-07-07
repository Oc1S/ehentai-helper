import type { Config } from '@/utils';
import { DEFAULT_CONFIG, splitFilename } from '@/utils';
import { removeInvalidCharFromFilename } from '@/utils/download';

export type PendingDownloadFilename = {
  downloadPath: string;
  index: number;
  total: number;
  ext: string;
  sourceUrl: string;
};

const MAX_PENDING_FILENAME_HINTS = 2000;
const pendingByDownloadUrl = new Map<string, PendingDownloadFilename[]>();
let pendingHintCount = 0;

const trimPendingFilenameHints = () => {
  while (pendingHintCount > MAX_PENDING_FILENAME_HINTS) {
    const oldestKey = pendingByDownloadUrl.keys().next().value as string | undefined;
    if (!oldestKey) return;

    const list = pendingByDownloadUrl.get(oldestKey);
    if (!list || list.length === 0) {
      pendingByDownloadUrl.delete(oldestKey);
      continue;
    }

    list.shift();
    pendingHintCount -= 1;
    if (list.length === 0) pendingByDownloadUrl.delete(oldestKey);
  }
};

export const enqueuePendingDownloadFilename = (
  downloadUrl: string,
  item: PendingDownloadFilename
) => {
  if (!downloadUrl) return;
  const list = pendingByDownloadUrl.get(downloadUrl) ?? [];
  list.push(item);
  pendingByDownloadUrl.set(downloadUrl, list);
  pendingHintCount += 1;
  trimPendingFilenameHints();
};

export const consumePendingDownloadFilename = (...downloadUrls: Array<string | undefined>) => {
  for (const downloadUrl of downloadUrls) {
    if (!downloadUrl) continue;

    const list = pendingByDownloadUrl.get(downloadUrl);
    if (!list || list.length === 0) continue;

    const item = list.shift();
    pendingHintCount -= 1;
    if (list.length === 0) pendingByDownloadUrl.delete(downloadUrl);
    if (item) return item;
  }

  return undefined;
};

export const normalizeDownloadDir = (path: string) => {
  const trimmed = path.trim().replace(/\\/g, '/');
  if (!trimmed) return DEFAULT_CONFIG.intermediateDownloadPath;
  const withoutLeading = trimmed.replace(/^\/+/, '');
  const normalized = withoutLeading.replace(/\/+/g, '/');
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
};

export const resolveGalleryDownloadPath = (basePath: string, galleryName: string) => {
  const base = normalizeDownloadDir(basePath || DEFAULT_CONFIG.intermediateDownloadPath);
  if (!galleryName.trim()) return base;
  return `${base}${removeInvalidCharFromFilename(galleryName)}/`.replace(/\/+/g, '/');
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
