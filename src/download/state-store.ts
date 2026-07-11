import { clearCbzTask } from '@/download/cbz-cache';
import { packAndDownloadCbz } from '@/download/cbz-pack';
import {
  buildStorageRelativeFilename,
  normalizeDownloadDir,
} from '@/download/download-filename';
import { trackedDownloadIds } from '@/download/download-registry';
import { rangeIndices } from '@/download/helpers';
import type { DownloadJobMode } from '@/download/types';
import {
  type ActiveDownloadTask,
  configStorage,
  type DownloadIndexEntry,
  downloadIndexMapStorage,
  downloadTaskStorage,
  type GalleryImageRecord,
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

  // running 期间：允许直接进入终态（全部 settle 完），避免「进度已满仍显示下载中」再闪到成功页。
  // dispatch_complete 仍由 orchestrator 的 markDispatchComplete 推进。
  if (task.status === 'running' && nextStatus === 'dispatch_complete') return;
  if (
    task.status === 'running' &&
    !options.allowRunningTerminal &&
    nextStatus !== 'completed' &&
    nextStatus !== 'partial_success' &&
    nextStatus !== 'failed'
  ) {
    return;
  }

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

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 匹配期望 basename，或 Chrome uniquify 产生的 `name (N).ext` 变体 */
const isExpectedBasenameOrUniquifyVariant = (actualBasename: string, expectedBasename: string) => {
  if (actualBasename === expectedBasename) return true;
  const dot = expectedBasename.lastIndexOf('.');
  if (dot <= 0) return false;
  const stem = expectedBasename.slice(0, dot);
  const ext = expectedBasename.slice(dot);
  return new RegExp(`^${escapeRegExp(stem)}(?: \\(\\d+\\))?${escapeRegExp(ext)}$`).test(
    actualBasename
  );
};

const pathIncludesDownloadDir = (absolutePath: string, downloadPath: string) => {
  const normalized = absolutePath.replace(/\\/g, '/').toLowerCase();
  const dir = normalizeDownloadDir(downloadPath).replace(/\/+$/, '').toLowerCase();
  if (!dir) return true;
  return normalized.includes(dir);
};

/** 相对路径与 Chrome 绝对路径视为同一文件，避免反复 patch 引发 UI 闪烁 */
const filenamesEquivalent = (a?: string, b?: string) => {
  if (!a || !b) return a === b;
  if (a === b) return true;
  const na = a.replace(/\\/g, '/');
  const nb = b.replace(/\\/g, '/');
  if (na === nb) return true;
  if (na.endsWith(nb) || nb.endsWith(na)) return true;
  const baseA = na.split('/').pop() ?? na;
  const baseB = nb.split('/').pop() ?? nb;
  return baseA === baseB;
};

/**
 * 解析 chromeDownloadId → gallery 绑定上下文。
 * 若 gallery 尚未写入 chromeDownloadId，不提前 upsert（避免 queued→in_progress→complete 三连闪烁），
 * 由 settle/patch 一次写终态。
 */
const resolveDownloadBinding = async (chromeDownloadId: number) => {
  const indexMap = downloadIndexMapStorage.getSnapshot() || (await downloadIndexMapStorage.get());
  const entry = indexMap[String(chromeDownloadId)];
  const taskId = normalizeTaskId(entry?.taskId);
  if (!entry?.galleryUrl || typeof entry.index !== 'number' || !taskId) return null;

  const task = await downloadTaskStorage.get();
  if (!task || task.taskId !== taskId || task.galleryUrl !== entry.galleryUrl) return null;

  const records = await galleryRecordsStorage.get();
  const image = records?.[entry.galleryUrl]?.images[String(entry.index)];
  if (image?.taskId && image.taskId !== taskId) return null;

  const needsBind = !image || image.chromeDownloadId !== chromeDownloadId;
  const resolvedImage: GalleryImageRecord =
    image && (!image.taskId || image.taskId === taskId)
      ? image
      : {
          index: entry.index,
          sourceUrl: entry.sourceUrl || '',
          taskId,
          state: 'queued',
          updatedAt: 0,
        };

  return { entry, image: resolvedImage, task, taskId, needsBind };
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
    ...(params.filename ? { filename: params.filename } : {}),
    updatedAt: Date.now(),
  });
  await refreshTaskStatus(params.galleryUrl);
  return true;
};

export const patchChromeDownloadMetadata = async (
  chromeDownloadId: number,
  patch: ChromeDownloadMetadata
) => {
  const context = await resolveDownloadBinding(chromeDownloadId);
  if (!context) return false;

  const { entry, image, taskId, needsBind } = context;

  if (needsBind) {
    const state =
      image.taskId === taskId &&
      (image.state === 'complete' || image.state === 'interrupted')
        ? image.state
        : 'in_progress';
    await galleryRecordsStorage.upsertImage(entry.galleryUrl, {
      index: entry.index,
      sourceUrl: entry.sourceUrl || image.sourceUrl || '',
      taskId,
      state,
      chromeDownloadId,
      ...(patch.filename ? { filename: patch.filename } : image.filename ? { filename: image.filename } : {}),
      ...(patch.error != null ? { error: patch.error } : {}),
      ...(patch.totalBytes != null ? { totalBytes: patch.totalBytes } : {}),
      updatedAt: Date.now(),
    });
    return true;
  }

  if (patch.filename && filenamesEquivalent(patch.filename, image.filename)) {
    const { filename: _ignored, ...rest } = patch;
    if (Object.keys(rest).length === 0) return true;
    await galleryRecordsStorage.patchImageByDownloadId(
      chromeDownloadId,
      entry.galleryUrl,
      entry.index,
      rest
    );
    return true;
  }

  await galleryRecordsStorage.patchImageByDownloadId(
    chromeDownloadId,
    entry.galleryUrl,
    entry.index,
    patch
  );
  return true;
};

export const settleChromeDownload = async (
  chromeDownloadId: number,
  chromeState: 'complete' | 'interrupted',
  error?: string,
  filename?: string
) => {
  const context = await resolveDownloadBinding(chromeDownloadId);
  if (!context) return false;

  const { entry, image, taskId, needsBind } = context;
  if (chromeState === 'interrupted' && image.state === 'complete') return true;

  // 已终态且已绑定：幂等返回，避免 reconcile 反复 search/patch 导致闪烁
  if (image.state === chromeState && !needsBind) {
    if (filename && !filenamesEquivalent(filename, image.filename)) {
      await galleryRecordsStorage.patchImageByDownloadId(
        chromeDownloadId,
        entry.galleryUrl,
        entry.index,
        { filename }
      );
    }
    return true;
  }

  let resolvedFilename = filename;
  if (!resolvedFilename) {
    try {
      const [item] = await chrome.downloads.search({ id: chromeDownloadId });
      if (item?.filename) resolvedFilename = item.filename;
      if (!error && item?.error) error = item.error;
    } catch {
      /* optional enrichment */
    }
  }
  if (!resolvedFilename) resolvedFilename = image.filename;

  // 未绑定或状态变化：一次 upsert 写终态，避免先 in_progress 再 complete 的闪烁
  if (needsBind || image.chromeDownloadId !== chromeDownloadId) {
    await galleryRecordsStorage.upsertImage(entry.galleryUrl, {
      index: entry.index,
      sourceUrl: entry.sourceUrl || image.sourceUrl || '',
      taskId,
      state: chromeState,
      chromeDownloadId,
      ...(resolvedFilename ? { filename: resolvedFilename } : {}),
      ...(chromeState === 'interrupted'
        ? { error: error ?? 'Download interrupted' }
        : {}),
      updatedAt: Date.now(),
    });
  } else {
    await galleryRecordsStorage.patchImageByDownloadId(
      chromeDownloadId,
      entry.galleryUrl,
      entry.index,
      {
        state: chromeState,
        error: chromeState === 'interrupted' ? error ?? 'Download interrupted' : undefined,
        sourceUrl: entry.sourceUrl || image.sourceUrl || '',
        ...(resolvedFilename && !filenamesEquivalent(resolvedFilename, image.filename)
          ? { filename: resolvedFilename }
          : {}),
      }
    );
  }
  await refreshTaskStatus(entry.galleryUrl);
  return true;
};

/**
 * 兜底：下载可能在 register 之前就已进入终态（onChanged complete 已错过）。
 * 主动 search 一次，若已终态则复用 settle 提交流程。
 */
export const ensureSettledIfAlreadyDone = async (chromeDownloadId: number) => {
  try {
    const [item] = await chrome.downloads.search({ id: chromeDownloadId });
    if (!item) return false;
    if (item.state === 'complete' || item.state === 'interrupted') {
      return settleChromeDownload(chromeDownloadId, item.state, item.error, item.filename);
    }
  } catch {
    /* downloads.search may fail for brand-new ids on some builds */
  }
  return false;
};

export const markImageInProgress = async (
  taskId: string,
  galleryUrl: string,
  index: number,
  sourceUrl = ''
) => {
  if (!(await isActiveTaskImage(galleryUrl, index, taskId))) return false;

  const records = await galleryRecordsStorage.get();
  const existing = records?.[galleryUrl]?.images[String(index)];
  if (
    existing?.taskId === taskId &&
    (existing.state === 'complete' ||
      existing.state === 'interrupted' ||
      existing.state === 'in_progress')
  ) {
    return true;
  }

  await galleryRecordsStorage.upsertImage(galleryUrl, {
    index,
    sourceUrl: sourceUrl || existing?.sourceUrl || '',
    taskId,
    state: 'in_progress',
    updatedAt: Date.now(),
  });
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
  // 若 settle 已把任务推到终态，不要降级回 dispatch_complete（否则成功页会闪回下载中）
  await downloadTaskStorage.set((prev) => {
    if (!prev || prev.taskId !== taskId) return prev;
    if (TERMINAL_TASK_STATUSES.has(prev.status)) return prev;
    if (prev.status === 'dispatch_complete') return prev;
    return { ...prev, status: 'dispatch_complete', updatedAt: Date.now() };
  });
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

  // 第一轮：按 chrome download id 自愈绑定并 settle
  for (const [idKey, entry] of Object.entries(indexMap || {})) {
    if (entry.galleryUrl !== task.galleryUrl || entry.taskId !== task.taskId) continue;
    const chromeDownloadId = Number(idKey);
    if (!Number.isFinite(chromeDownloadId)) continue;

    try {
      const [item] = await chrome.downloads.search({ id: chromeDownloadId });
      if (item?.state === 'complete' || item?.state === 'interrupted') {
        await settleChromeDownload(chromeDownloadId, item.state, item.error, item.filename);
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

      // 已有 chromeDownloadId：优先按 id 再 settle 一次
      if (image.chromeDownloadId != null) {
        try {
          const [item] = await chrome.downloads.search({ id: image.chromeDownloadId });
          if (item?.state === 'complete' || item?.state === 'interrupted') {
            await settleChromeDownload(
              image.chromeDownloadId,
              item.state,
              item.error,
              item.filename
            );
            continue;
          }
        } catch {
          /* ignore */
        }
      }

      // 正在抓取/尚未拿到 chrome id：不要用 basename 误匹配旧文件
      if (image.state === 'in_progress' && image.chromeDownloadId == null) continue;
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
      const searchStem = basename.includes('.')
        ? basename.slice(0, basename.lastIndexOf('.'))
        : basename;

      try {
        const items = await chrome.downloads.search({ query: [searchStem] });
        const match = items.find((item) => {
          if (item.state !== 'complete' && item.state !== 'interrupted') return false;
          const normalized = item.filename.replace(/\\/g, '/');
          if (!pathIncludesDownloadDir(normalized, task.downloadPath)) return false;
          const actualBasename = normalized.split('/').pop() ?? normalized;
          return isExpectedBasenameOrUniquifyVariant(actualBasename, basename);
        });
        if (!match) continue;

        await registerChromeDownload({
          id: match.id,
          index,
          total: task.totalImages,
          downloadPath: task.downloadPath,
          galleryUrl: task.galleryUrl,
          sourceUrl: image.sourceUrl,
          taskId: task.taskId,
          filename: match.filename || expectedFilename,
        });
        await settleChromeDownload(
          match.id,
          match.state as 'complete' | 'interrupted',
          match.error,
          match.filename
        );
      } catch {
        /* The bounded filename search is a best-effort repair path. */
      }
    }
  }

  await refreshTaskStatus(task.galleryUrl, { allowRunningTerminal: true });
};
