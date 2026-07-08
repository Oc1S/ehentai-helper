import { clearCbzTask } from '@/download/cbz-cache';
import { packAndDownloadCbz } from '@/download/cbz-pack';
import { buildStorageRelativeFilename } from '@/download/download-filename';
import { trackedDownloadIds } from '@/download/download-registry';
import { rangeIndices } from '@/download/helpers';
import type { DownloadJobMode } from '@/download/types';
import {
  type ActiveDownloadTask,
  configStorage,
  type DownloadIndexEntry,
  downloadIndexMapStorage,
  downloadTaskStorage,
  galleryRecordsStorage,
} from '@/storage';

export type RuntimeDownloadTaskParams = {
  taskId: string;
  mode?: DownloadJobMode;
  galleryFrontPageUrl: string;
  galleryName: string;
  galleryId: string;
  downloadPath: string;
  rangeStart: number;
  rangeEnd: number;
  imagesPerPage: number;
  numPages: number;
  totalImages: number;
};

export type StartTaskParams = RuntimeDownloadTaskParams & {
  expectedCount: number;
  queuedIndices: number[];
  startedAt: number;
  targetIndices: number[];
};

export type RegisterChromeDownloadParams = {
  id: number;
  index: number;
  total: number;
  downloadPath: string;
  galleryUrl: string;
  sourceUrl: string;
  taskId: string | null;
  filename?: string;
};

export type ChromeDownloadMetadata = {
  filename?: string;
  error?: string;
  totalBytes?: number;
};

const TERMINAL_TASK_STATUSES = new Set<ActiveDownloadTask['status']>([
  'completed',
  'partial_success',
  'failed',
  'cancelled',
]);

const MAX_INDEX_ENTRIES = 5000;

const normalizeTaskId = (taskId: string | null | undefined) => taskId ?? undefined;

const trimIndexMap = (
  map: Record<string, DownloadIndexEntry>
): Record<string, DownloadIndexEntry> => {
  const keys = Object.keys(map);
  if (keys.length <= MAX_INDEX_ENTRIES) return map;
  const sorted = keys.map(Number).sort((a, b) => a - b);
  const next = { ...map };
  for (const id of sorted.slice(0, keys.length - MAX_INDEX_ENTRIES)) {
    delete next[String(id)];
  }
  return next;
};

const resolveDownloadExt = (sourceImageUrl: string): string => {
  try {
    const path = new URL(sourceImageUrl).pathname;
    const dot = path.lastIndexOf('.');
    if (dot === -1) return 'jpg';
    return path.slice(dot + 1).toLowerCase() || 'jpg';
  } catch {
    return 'jpg';
  }
};

const patchActiveTask = async (taskId: string, patch: Partial<ActiveDownloadTask>) => {
  await downloadTaskStorage.set((prev) => {
    if (!prev || prev.taskId !== taskId) return prev;
    return { ...prev, ...patch, updatedAt: Date.now() };
  });
};

const taskTargetIndices = (task: ActiveDownloadTask) =>
  task.targetIndices ?? rangeIndices(task.rangeStart, task.rangeEnd);

const countTaskImages = (
  task: ActiveDownloadTask,
  images: Record<string, { state: string; taskId?: string }> | undefined
) => {
  let complete = 0;
  let interrupted = 0;
  let inProgress = 0;

  for (const index of taskTargetIndices(task)) {
    const image = images?.[String(index)];
    if (!image || image.taskId !== task.taskId) continue;
    if (image.state === 'complete') complete++;
    else if (image.state === 'interrupted') interrupted++;
    else if (image.state === 'in_progress') inProgress++;
  }

  return { complete, interrupted, inProgress };
};

const resolveTaskStatus = (
  task: ActiveDownloadTask,
  counts: { complete: number; interrupted: number; inProgress: number }
): ActiveDownloadTask['status'] => {
  const settled = counts.complete + counts.interrupted;
  if (counts.inProgress > 0 || settled < task.expectedCount) return 'dispatch_complete';
  if (counts.complete === task.expectedCount) return 'completed';
  if (counts.complete === 0) return 'failed';
  return 'partial_success';
};

const getCompleteIndices = (
  task: ActiveDownloadTask,
  images: Record<string, { state: string; taskId?: string }> | undefined
) =>
  taskTargetIndices(task).filter((index) => {
    const image = images?.[String(index)];
    return image?.taskId === task.taskId && image.state === 'complete';
  });

const claimCbzPacking = async (taskId: string) => {
  let claimed = false;
  await downloadTaskStorage.set((prev) => {
    if (!prev || prev.taskId !== taskId || prev.cbzPacked) return prev;
    claimed = true;
    return { ...prev, cbzPacked: true, updatedAt: Date.now() };
  });
  return claimed;
};

const packCompletedCbz = async (task: ActiveDownloadTask) => {
  const claimed = await claimCbzPacking(task.taskId);
  if (!claimed) return;

  const config = await configStorage.get();
  if ((config.outputMode ?? 'files') === 'files') return;

  const records = await galleryRecordsStorage.get();
  const gallery = records?.[task.galleryUrl];
  const completeIndices = getCompleteIndices(task, gallery?.images);
  if (completeIndices.length === 0) {
    await clearCbzTask(task.taskId);
    return;
  }

  await packAndDownloadCbz(task, config, completeIndices);
};

const finishTerminalTask = async (task: ActiveDownloadTask) => {
  if (task.status === 'completed' || task.status === 'partial_success') {
    await packCompletedCbz(task);
  } else if (task.status === 'failed') {
    await clearCbzTask(task.taskId);
  }
};

const refreshTaskStatus = async (
  galleryUrl: string,
  options: { allowRunningTerminal?: boolean } = {}
) => {
  const task = await downloadTaskStorage.get();
  if (!task || task.galleryUrl !== galleryUrl || task.status === 'cancelled') return;

  if (TERMINAL_TASK_STATUSES.has(task.status)) {
    await finishTerminalTask(task);
    return;
  }

  const records = await galleryRecordsStorage.get();
  const gallery = records?.[galleryUrl];
  const nextStatus = resolveTaskStatus(task, countTaskImages(task, gallery?.images));

  if (task.status === 'running' && !options.allowRunningTerminal) return;
  if (task.status === 'running' && nextStatus === 'dispatch_complete') return;

  if (nextStatus === 'dispatch_complete') {
    if (task.status !== 'dispatch_complete') {
      await patchActiveTask(task.taskId, { status: 'dispatch_complete' });
    }
    return;
  }

  await patchActiveTask(task.taskId, { status: nextStatus });
  await finishTerminalTask({ ...task, status: nextStatus });
};

const isActiveTaskImage = async (galleryUrl: string, index: number, taskId: string) => {
  const task = await downloadTaskStorage.get();
  if (!task || task.taskId !== taskId || task.galleryUrl !== galleryUrl) return false;

  const records = await galleryRecordsStorage.get();
  const image = records?.[galleryUrl]?.images[String(index)];
  if (image?.taskId && image.taskId !== taskId) return false;
  return true;
};

const getRegisteredImageContext = async (chromeDownloadId: number) => {
  const indexMap = downloadIndexMapStorage.getSnapshot() || (await downloadIndexMapStorage.get());
  const entry = indexMap[String(chromeDownloadId)];
  const taskId = normalizeTaskId(entry?.taskId);
  if (!entry?.galleryUrl || typeof entry.index !== 'number' || !taskId) return null;

  const task = await downloadTaskStorage.get();
  if (!task || task.taskId !== taskId || task.galleryUrl !== entry.galleryUrl) return null;

  const records = await galleryRecordsStorage.get();
  const image = records?.[entry.galleryUrl]?.images[String(entry.index)];
  if (!image || image.taskId !== taskId || image.chromeDownloadId !== chromeDownloadId) {
    return null;
  }

  return { entry, image, task, taskId };
};

export const startTask = async (params: StartTaskParams) => {
  await galleryRecordsStorage.upsertGallery({
    galleryUrl: params.galleryFrontPageUrl,
    galleryName: params.galleryName,
    galleryId: params.galleryId,
    downloadPath: params.downloadPath,
    total: params.totalImages,
  });

  await downloadTaskStorage.set({
    taskId: params.taskId,
    mode: params.mode,
    status: 'running',
    galleryUrl: params.galleryFrontPageUrl,
    galleryName: params.galleryName,
    galleryId: params.galleryId,
    downloadPath: params.downloadPath,
    rangeStart: params.rangeStart,
    rangeEnd: params.rangeEnd,
    imagesPerPage: params.imagesPerPage,
    numPages: params.numPages,
    totalImages: params.totalImages,
    expectedCount: params.expectedCount,
    targetIndices: params.targetIndices,
    cbzPacked: false,
    startedAt: params.startedAt,
    updatedAt: Date.now(),
  });

  await galleryRecordsStorage.markImagesQueued(
    params.galleryFrontPageUrl,
    params.queuedIndices,
    params.taskId
  );
};

export const registerChromeDownload = async (params: RegisterChromeDownloadParams) => {
  const taskId = normalizeTaskId(params.taskId);
  trackedDownloadIds.add(params.id);

  await downloadIndexMapStorage.set((map) => {
    const next = trimIndexMap({
      ...(map || {}),
      [String(params.id)]: {
        index: params.index,
        total: params.total,
        downloadPath: params.downloadPath,
        galleryUrl: params.galleryUrl,
        sourceUrl: params.sourceUrl,
        taskId,
      },
    });
    return next;
  });

  if (!taskId || !(await isActiveTaskImage(params.galleryUrl, params.index, taskId))) {
    return false;
  }

  const records = await galleryRecordsStorage.get();
  const existing = records?.[params.galleryUrl]?.images[String(params.index)];
  const state =
    existing?.taskId === taskId &&
    (existing.state === 'complete' || existing.state === 'interrupted')
      ? existing.state
      : 'in_progress';

  await galleryRecordsStorage.upsertImage(params.galleryUrl, {
    index: params.index,
    sourceUrl: params.sourceUrl || existing?.sourceUrl || '',
    taskId,
    state,
    chromeDownloadId: params.id,
    filename: params.filename,
    updatedAt: Date.now(),
  });
  await refreshTaskStatus(params.galleryUrl);
  return true;
};

export const patchChromeDownloadMetadata = async (
  chromeDownloadId: number,
  patch: ChromeDownloadMetadata
) => {
  const context = await getRegisteredImageContext(chromeDownloadId);
  if (!context) return false;

  await galleryRecordsStorage.patchImageByDownloadId(
    chromeDownloadId,
    context.entry.galleryUrl,
    context.entry.index,
    patch
  );
  return true;
};

export const settleChromeDownload = async (
  chromeDownloadId: number,
  chromeState: 'complete' | 'interrupted',
  error?: string
) => {
  const context = await getRegisteredImageContext(chromeDownloadId);
  if (!context) return false;

  const { entry, image } = context;
  if (chromeState === 'interrupted' && image.state === 'complete') return true;
  if (image.state === chromeState) return true;

  await galleryRecordsStorage.patchImageByDownloadId(
    chromeDownloadId,
    entry.galleryUrl,
    entry.index,
    {
      state: chromeState,
      error: chromeState === 'interrupted' ? error ?? 'Download interrupted' : undefined,
      sourceUrl: entry.sourceUrl || image.sourceUrl || '',
    }
  );
  await refreshTaskStatus(entry.galleryUrl);
  return true;
};

export const completeImage = async (
  taskId: string,
  galleryUrl: string,
  index: number,
  sourceUrl: string
) => {
  if (!(await isActiveTaskImage(galleryUrl, index, taskId))) return false;

  await galleryRecordsStorage.upsertImage(galleryUrl, {
    index,
    sourceUrl,
    taskId,
    state: 'complete',
    updatedAt: Date.now(),
  });
  await refreshTaskStatus(galleryUrl);
  return true;
};

export const failImage = async (
  taskId: string,
  galleryUrl: string,
  index: number,
  error: string,
  sourceUrl = ''
) => {
  if (!(await isActiveTaskImage(galleryUrl, index, taskId))) return false;

  const records = await galleryRecordsStorage.get();
  const existing = records?.[galleryUrl]?.images[String(index)];
  if (existing?.state === 'complete') return true;

  await galleryRecordsStorage.upsertImage(galleryUrl, {
    index,
    sourceUrl: sourceUrl || existing?.sourceUrl || '',
    taskId,
    state: 'interrupted',
    error,
    updatedAt: Date.now(),
  });
  await refreshTaskStatus(galleryUrl);
  return true;
};

export const markDispatchComplete = async (taskId: string, galleryUrl: string) => {
  await patchActiveTask(taskId, { status: 'dispatch_complete' });
  await refreshTaskStatus(galleryUrl);
};

export const clearActiveTask = async (taskId?: string) => {
  const task = await downloadTaskStorage.get();
  if (!task || (taskId && task.taskId !== taskId)) return;
  await clearCbzTask(task.taskId);
  await downloadTaskStorage.set(null);
};

export const reconcileActiveTask = async (galleryUrl?: string) => {
  const task = await downloadTaskStorage.get();
  if (!task || (galleryUrl && task.galleryUrl !== galleryUrl)) return;

  const config = await configStorage.get();
  const indexMap = downloadIndexMapStorage.getSnapshot() || (await downloadIndexMapStorage.get());

  for (const [idKey, entry] of Object.entries(indexMap || {})) {
    if (entry.galleryUrl !== task.galleryUrl || entry.taskId !== task.taskId) continue;
    const chromeDownloadId = Number(idKey);
    if (!Number.isFinite(chromeDownloadId)) continue;

    try {
      const [item] = await chrome.downloads.search({ id: chromeDownloadId });
      if (item?.state === 'complete' || item?.state === 'interrupted') {
        await settleChromeDownload(chromeDownloadId, item.state, item.error);
      } else if (item) {
        await patchChromeDownloadMetadata(chromeDownloadId, {
          filename: item.filename,
          error: item.error,
          totalBytes: item.totalBytes,
        });
      }
    } catch {
      /* downloads.search can fail for stale ids */
    }
  }

  const records = await galleryRecordsStorage.get();
  const gallery = records?.[task.galleryUrl];
  if (gallery) {
    for (const index of taskTargetIndices(task)) {
      const image = gallery.images[String(index)];
      if (!image || image.taskId !== task.taskId || image.state === 'complete') continue;
      if (!image.sourceUrl) continue;

      const expectedFilename = buildStorageRelativeFilename(config, {
        downloadPath: task.downloadPath,
        index,
        total: task.totalImages,
        ext: resolveDownloadExt(image.sourceUrl),
        sourceUrl: image.sourceUrl,
        taskId: task.taskId,
        galleryUrl: task.galleryUrl,
      });
      const basename = expectedFilename.split('/').pop() ?? expectedFilename;

      try {
        const items = await chrome.downloads.search({ query: [basename] });
        const match = items.find(
          (item) =>
            item.filename.replace(/\\/g, '/').endsWith(basename) &&
            (item.state === 'complete' || item.state === 'interrupted')
        );
        if (!match) continue;

        await registerChromeDownload({
          id: match.id,
          index,
          total: task.totalImages,
          downloadPath: task.downloadPath,
          galleryUrl: task.galleryUrl,
          sourceUrl: image.sourceUrl,
          taskId: task.taskId,
          filename: expectedFilename,
        });
        await settleChromeDownload(match.id, match.state as 'complete' | 'interrupted', match.error);
      } catch {
        /* The bounded filename search is a best-effort repair path. */
      }
    }
  }

  await refreshTaskStatus(task.galleryUrl, { allowRunningTerminal: true });
};
