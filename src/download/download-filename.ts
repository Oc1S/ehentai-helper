import { pendingDownloadHintsStorage } from '@/storage/pending-download-hints';
import type { Config } from '@/utils';
import { DEFAULT_CONFIG, splitFilename } from '@/utils';
import { removeInvalidCharFromFilename } from '@/utils/download';

export type PendingDownloadFilename = {
  downloadPath: string;
  index: number;
  total: number;
  ext: string;
  sourceUrl: string;
  taskId?: string;
  galleryUrl?: string;
  filename?: string;
};

const MAX_PENDING_FILENAME_HINTS = 2000;
const pendingByDownloadUrl = new Map<string, PendingDownloadFilename[]>();
let pendingHintCount = 0;
let pendingHintsHydrated = false;

const persistAllPendingHints = async () => {
  const next: Record<string, PendingDownloadFilename[]> = {};
  for (const [url, list] of pendingByDownloadUrl.entries()) {
    if (list.length > 0) next[url] = [...list];
  }
  await pendingDownloadHintsStorage.set(next);
};

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

/** SW 重启后把 session 中的 pending hint 灌回内存，供 onDeterminingFilename 同步 peek */
export const hydratePendingDownloadHintsFromSession = async () => {
  if (pendingHintsHydrated) return;
  const persisted = await pendingDownloadHintsStorage.get();
  pendingHintsHydrated = true;
  if (!persisted) return;

  for (const [url, list] of Object.entries(persisted)) {
    if (!url || !list?.length) continue;
    if (pendingByDownloadUrl.has(url)) continue;
    pendingByDownloadUrl.set(url, [...list]);
    pendingHintCount += list.length;
  }
  trimPendingFilenameHints();
  await persistAllPendingHints();
};

export const enqueuePendingDownloadFilename = async (
  downloadUrl: string,
  item: PendingDownloadFilename
) => {
  if (!downloadUrl) return;
  const list = pendingByDownloadUrl.get(downloadUrl) ?? [];
  list.push(item);
  pendingByDownloadUrl.set(downloadUrl, list);
  pendingHintCount += 1;
  trimPendingFilenameHints();
  // Chrome 下载是外部副作用；必须先持久化 owner hint，确保 callback 丢失后 onCreated 仍可恢复绑定。
  await persistAllPendingHints();
};

const removePendingHintFromMemory = (downloadUrl: string) => {
  const list = pendingByDownloadUrl.get(downloadUrl);
  if (!list || list.length === 0) return undefined;

  const item = list.shift();
  pendingHintCount -= 1;
  if (list.length === 0) pendingByDownloadUrl.delete(downloadUrl);
  return { item, list };
};

const updatePersistedPendingHints = async (
  downloadUrl: string,
  list: PendingDownloadFilename[]
) => {
  await pendingDownloadHintsStorage.set((map) => {
    if (!map) return map;
    const next = { ...map };
    if (list.length === 0) delete next[downloadUrl];
    else next[downloadUrl] = list;
    return next;
  });
};

export const consumePendingDownloadFilename = async (
  ...downloadUrls: Array<string | undefined>
) => {
  for (const downloadUrl of downloadUrls) {
    if (!downloadUrl) continue;

    const memoryMatch = removePendingHintFromMemory(downloadUrl);
    if (memoryMatch?.item) {
      await updatePersistedPendingHints(downloadUrl, memoryMatch.list);
      return memoryMatch.item;
    }
  }

  const persisted = await pendingDownloadHintsStorage.get();
  for (const downloadUrl of downloadUrls) {
    if (!downloadUrl) continue;
    const list = persisted?.[downloadUrl];
    if (!list || list.length === 0) continue;

    const [item, ...rest] = list;
    if (item) {
      await updatePersistedPendingHints(downloadUrl, rest);
      return item;
    }
  }

  return undefined;
};

export const peekPendingDownloadFilenameSync = (
  ...downloadUrls: Array<string | undefined>
): PendingDownloadFilename | undefined => {
  for (const downloadUrl of downloadUrls) {
    if (!downloadUrl) continue;
    const list = pendingByDownloadUrl.get(downloadUrl);
    if (list && list.length > 0) return list[0];
  }
  return undefined;
};

/**
 * 读取但不消费 pending intent：确定文件名时只 peek；拿到 chrome download id
 * 并成功注册 owner 后才 consume，避免 onCreated/callback 顺序不同导致 hint 丢失。
 */
export const peekPendingDownloadFilename = async (
  ...downloadUrls: Array<string | undefined>
): Promise<PendingDownloadFilename | undefined> => {
  const memoryMatch = peekPendingDownloadFilenameSync(...downloadUrls);
  if (memoryMatch) return memoryMatch;

  // 内存未命中（service worker 重启后），读 session storage
  const persisted = await pendingDownloadHintsStorage.get();
  for (const downloadUrl of downloadUrls) {
    if (!downloadUrl) continue;
    const list = persisted?.[downloadUrl];
    if (list && list.length > 0) return list[0];
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
