import type { DownloadJobMode } from '@/download/types';

import type { BaseStorage } from './base';
import { createStorage, StorageType } from './base';

export type DownloadTaskStatus =
  | 'running'
  | 'dispatch_complete'
  | 'completed'
  | 'partial_success'
  | 'failed'
  | 'cancelled';

export type ActiveDownloadTask = {
  taskId: string;
  mode?: DownloadJobMode;
  status: DownloadTaskStatus;
  galleryUrl: string;
  galleryName: string;
  galleryId: string;
  downloadPath: string;
  rangeStart: number;
  rangeEnd: number;
  imagesPerPage: number;
  numPages: number;
  totalImages: number;
  expectedCount: number;
  queueFailedCount: number;
  /** 本次任务实际下载的序号；缺省为 range 内全部 */
  targetIndices?: number[];
  /** CBZ 已打包下载，避免重复触发 */
  cbzPacked?: boolean;
  startedAt: number;
  updatedAt: number;
};

export const downloadTaskStorage: BaseStorage<ActiveDownloadTask | null> =
  createStorage<ActiveDownloadTask | null>('download-active-task', null, {
    storageType: StorageType.Local,
    liveUpdate: true,
  });
