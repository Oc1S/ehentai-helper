import type { PendingDownloadFilename } from '@/download/download-filename';

import type { BaseStorage } from './base';
import { createStorage, StorageType } from './base';

/**
 * 持久化 pending download hint（service worker 重启后内存 map 会丢失）。
 * key 为 downloadUrl，value 为该 url 对应的 hint 队列。
 * onCreated 兜底注册时从这里读取 index/galleryUrl/taskId。
 */
export type PendingDownloadHints = Record<string, PendingDownloadFilename[]>;

export const pendingDownloadHintsStorage: BaseStorage<PendingDownloadHints> = createStorage<
  PendingDownloadHints
>('pending-download-hints', {}, {
  storageType: StorageType.Session,
  sessionAccessForContentScripts: false,
  liveUpdate: false,
});
