import { clearCbzTask, putCbzImage } from '@/download/cbz-cache';
import { packAndDownloadCbz } from '@/download/cbz-pack';
import {
  buildStorageRelativeFilename,
  consumePendingDownloadFilename,
  enqueuePendingDownloadFilename,
} from '@/download/download-filename';
import { mapChromeDownloadState, registerDownloadIndex } from '@/download/download-registry';
import { rangeIndices } from '@/download/helpers';
import type { DownloadJobMode, DownloadJobPayload } from '@/download/types';
import {
  type ActiveDownloadTask,
  configStorage,
  downloadTaskStorage,
  galleryRecordsStorage,
} from '@/storage';
import { authFetch, type Config } from '@/utils';
import { createDownloadUrl, releaseDownloadUrlOnDownloadDone } from '@/utils/blob-download-url';
import {
  extractImagePageNlReloadUrl,
  extractImagePageUrlsFromHtml,
  extractImageUrlFromPageHtml,
  type ParsedImageUrl,
} from '@/utils/gallery-html-parse';
import { probeImageUrl, resolveImageBlob } from '@/utils/image-blob';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type JobParams = DownloadJobPayload & {
  mode?: DownloadJobMode;
};

type RuntimeJobParams = JobParams & {
  taskId: string;
};

let cancelRequested = false;
let finalizeTimer: ReturnType<typeof setTimeout> | null = null;
let currentJobId = 0;

type DownloadSemaphore = {
  limit: number;
  active: number;
  waiters: Array<() => void>;
};

/** 单 gallery 下载时同时进行中的图片下载数量上限（定死，不暴露给用户配置） */
const MAX_CONCURRENT_DOWNLOADS = 10;

const downloadSemaphore: DownloadSemaphore = {
  limit: MAX_CONCURRENT_DOWNLOADS,
  active: 0,
  waiters: [],
};

const setDownloadConcurrency = (limit: number) => {
  const next = Math.max(1, Math.floor(limit) || 1);
  downloadSemaphore.limit = next;
  while (
    downloadSemaphore.active < downloadSemaphore.limit &&
    downloadSemaphore.waiters.length > 0
  ) {
    const waiter = downloadSemaphore.waiters.shift() as () => void;
    downloadSemaphore.active++;
    waiter();
  }
};

const acquireDownloadSlot = (): Promise<void> =>
  new Promise<void>((resolve) => {
    if (downloadSemaphore.active < downloadSemaphore.limit) {
      downloadSemaphore.active++;
      resolve();
    } else {
      downloadSemaphore.waiters.push(resolve);
    }
  });

const releaseDownloadSlot = () => {
  if (downloadSemaphore.waiters.length > 0) {
    const next = downloadSemaphore.waiters.shift() as () => void;
    next();
  } else {
    downloadSemaphore.active = Math.max(0, downloadSemaphore.active - 1);
  }
};

const resetDownloadSemaphore = () => {
  downloadSemaphore.active = 0;
  const waiters = downloadSemaphore.waiters;
  downloadSemaphore.waiters = [];
  for (const waiter of waiters) {
    waiter();
  }
};

export const requestCancelDownload = () => {
  cancelRequested = true;
  resetDownloadSemaphore();
};

const patchTask = async (patch: Partial<ActiveDownloadTask>) => {
  await downloadTaskStorage.set((prev) => {
    if (!prev) return prev;
    return { ...prev, ...patch, updatedAt: Date.now() };
  });
};

const needsCbzCache = (config: Config) => (config.outputMode ?? 'files') !== 'files';
const needsFileDownload = (config: Config) => (config.outputMode ?? 'files') !== 'cbz';
const needsImageBlob = (config: Config) =>
  needsCbzCache(config) ||
  config.saveOriginalImages ||
  Boolean(config.imageFormat && config.imageFormat !== 'original');

const waitForChromeDownloadSettled = (chromeDownloadId: number): Promise<void> =>
  new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      chrome.downloads.onChanged.removeListener(onChanged);
      resolve();
    };
    const onChanged = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id !== chromeDownloadId) return;
      const next = delta.state?.current;
      if (next === 'complete' || next === 'interrupted') finish();
    };
    chrome.downloads.onChanged.addListener(onChanged);
    void chrome.downloads
      .search({ id: chromeDownloadId })
      .then(([item]) => {
        if (item && (item.state === 'complete' || item.state === 'interrupted')) finish();
      })
      .catch(() => undefined);
  });

const ensureChromeDownloadSettledState = async (
  chromeDownloadId: number,
  params: RuntimeJobParams,
  currentIndex: number,
  sourceImageUrl: string
) => {
  try {
    const [item] = await chrome.downloads.search({ id: chromeDownloadId });
    if (!item) return;
    const mapped = item.state ? mapChromeDownloadState(item.state) : undefined;
    if (mapped !== 'complete' && mapped !== 'interrupted') return;

    // 已是目标 state 则跳过，避免与 onChanged 重复回写导致 queueFailedCount 翻倍
    const records = await galleryRecordsStorage.get();
    const image = records?.[params.galleryFrontPageUrl]?.images[String(currentIndex)];
    if (image?.state === mapped) return;

    if (mapped === 'complete') {
      await markImageComplete(
        params.taskId,
        params.galleryFrontPageUrl,
        currentIndex,
        sourceImageUrl
      );
    } else {
      await markImageFailed(
        params.taskId,
        params.galleryFrontPageUrl,
        currentIndex,
        item.error ?? 'Download interrupted',
        sourceImageUrl
      );
    }
  } catch (e) {
    console.warn('ensure settled state failed@', e);
  }
};

const startChromeFileDownload = async (
  config: Config,
  params: RuntimeJobParams,
  sourceImageUrl: string,
  currentIndex: number,
  ext: string,
  downloadUrl: string,
  revoke?: () => void
) => {
  const filenameHint = {
    downloadPath: params.downloadPath,
    index: currentIndex,
    total: params.totalImages,
    ext,
    sourceUrl: sourceImageUrl,
  };
  const relativeFilename = buildStorageRelativeFilename(config, filenameHint);
  enqueuePendingDownloadFilename(downloadUrl, filenameHint);

  return new Promise<void>((resolve) => {
    chrome.downloads.download(
      {
        url: downloadUrl,
        filename: relativeFilename,
        conflictAction: config.filenameConflictAction,
      },
      (id) => {
        void (async () => {
          if (chrome.runtime.lastError || typeof id !== 'number') {
            consumePendingDownloadFilename(downloadUrl);
            revoke?.();
            await markImageFailed(
              params.taskId,
              params.galleryFrontPageUrl,
              currentIndex,
              chrome.runtime.lastError?.message ?? 'Download API rejected request',
              sourceImageUrl
            );
            resolve();
            return;
          }

          try {
            await registerDownloadIndex({
              id,
              index: currentIndex,
              total: params.totalImages,
              downloadPath: params.downloadPath,
              galleryUrl: params.galleryFrontPageUrl,
              sourceUrl: sourceImageUrl,
              taskId: params.taskId,
            });
            releaseDownloadUrlOnDownloadDone(id, revoke);
            onGalleryRecordChanged(params.galleryFrontPageUrl);
            await waitForChromeDownloadSettled(id);
            await ensureChromeDownloadSettledState(id, params, currentIndex, sourceImageUrl);
          } catch (error) {
            console.error('register download failed@', error);
            revoke?.();
            await markImageFailed(
              params.taskId,
              params.galleryFrontPageUrl,
              currentIndex,
              'Failed to register download',
              sourceImageUrl
            );
            resolve();
            return;
          }
          resolve();
        })();
      }
    );
  });
};

const markImageComplete = async (
  taskId: string,
  galleryUrl: string,
  index: number,
  sourceUrl: string
) => {
  await galleryRecordsStorage.upsertImage(galleryUrl, {
    index,
    sourceUrl,
    taskId,
    state: 'complete',
    updatedAt: Date.now(),
  });
  onGalleryRecordChanged(galleryUrl);
};

const getCompleteIndices = (
  task: ActiveDownloadTask,
  images: Record<string, { state: string; taskId?: string }> | undefined
): number[] => {
  const indices = task.targetIndices ?? rangeIndices(task.rangeStart, task.rangeEnd);
  return indices.filter((i) => {
    const img = images?.[String(i)];
    return img?.taskId === task.taskId && img.state === 'complete';
  });
};

const maybePackCbz = async (task: ActiveDownloadTask, config: Config, galleryUrl: string) => {
  if ((config.outputMode ?? 'files') === 'files') return;

  const records = await galleryRecordsStorage.get();
  const gallery = records?.[galleryUrl];
  const completeIndices = getCompleteIndices(task, gallery?.images);
  if (completeIndices.length === 0) {
    await clearCbzTask(task.taskId);
    return;
  }

  await packAndDownloadCbz(task, config, completeIndices);
};

const markImageFailed = async (
  taskId: string,
  galleryUrl: string,
  index: number,
  error: string,
  sourceUrl = ''
) => {
  await galleryRecordsStorage.upsertImage(galleryUrl, {
    index,
    sourceUrl,
    taskId,
    state: 'interrupted',
    error,
    updatedAt: Date.now(),
  });
  await downloadTaskStorage.set((prev) => {
    if (!prev) return prev;
    return {
      ...prev,
      queueFailedCount: prev.queueFailedCount + 1,
      updatedAt: Date.now(),
    };
  });
  onGalleryRecordChanged(galleryUrl);
};

const countTargetTerminal = (
  task: ActiveDownloadTask,
  images: Record<string, { state: string; taskId?: string }> | undefined
) => {
  let complete = 0;
  let interrupted = 0;
  let inProgress = 0;
  const indices = task.targetIndices ?? rangeIndices(task.rangeStart, task.rangeEnd);

  for (const i of indices) {
    const img = images?.[String(i)];
    if (!img || img.taskId !== task.taskId) continue;
    if (img.state === 'complete') complete++;
    else if (img.state === 'interrupted') interrupted++;
    else if (img.state === 'in_progress') inProgress++;
  }
  return { complete, interrupted, inProgress };
};

const resolveFinalStatus = (
  task: ActiveDownloadTask,
  counts: { complete: number; interrupted: number; inProgress: number }
): ActiveDownloadTask['status'] => {
  const { complete, interrupted, inProgress } = counts;
  const settled = complete + interrupted;
  if (inProgress > 0 || settled < task.expectedCount) {
    return 'dispatch_complete';
  }
  if (complete === task.expectedCount) return 'completed';
  if (complete === 0) return 'failed';
  return 'partial_success';
};

const scheduleFinalize = (galleryUrl: string) => {
  if (finalizeTimer !== null) clearTimeout(finalizeTimer);
  finalizeTimer = setTimeout(() => {
    finalizeTimer = null;
    void finalizeTask(galleryUrl);
  }, 400);
};

export const finalizeTask = async (galleryUrl: string) => {
  const task = await downloadTaskStorage.get();
  if (!task || task.galleryUrl !== galleryUrl) return;
  if (task.status === 'cancelled') return;

  const terminal = task.status === 'completed' || task.status === 'partial_success';
  if (terminal) {
    if (!task.cbzPacked) {
      const config = await configStorage.get();
      await maybePackCbz(task, config, galleryUrl);
      await patchTask({ cbzPacked: true });
    }
    return;
  }

  const records = await galleryRecordsStorage.get();
  const gallery = records?.[galleryUrl];
  const counts = countTargetTerminal(task, gallery?.images);
  const nextStatus = resolveFinalStatus(task, counts);

  if (nextStatus === 'dispatch_complete') {
    await patchTask({ status: 'dispatch_complete' });
    scheduleFinalize(galleryUrl);
    return;
  }

  await patchTask({ status: nextStatus });

  if (nextStatus === 'completed' || nextStatus === 'partial_success') {
    const config = await configStorage.get();
    const updated = { ...task, status: nextStatus };
    await maybePackCbz(updated, config, galleryUrl);
    await patchTask({ cbzPacked: true });
  } else if (nextStatus === 'failed') {
    await clearCbzTask(task.taskId);
  }
};

export const onGalleryRecordChanged = (galleryUrl: string) => {
  void finalizeTask(galleryUrl);
};

type ImagePageCandidate = {
  pageUrl: string;
  parsed: ParsedImageUrl | null;
  reloadUrl: string | null;
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

const fetchImagePageCandidate = async (
  config: Config,
  pageUrl: string
): Promise<ImagePageCandidate> => {
  const res = await authFetch(pageUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const reloadUrl = extractImagePageNlReloadUrl(html, pageUrl);

  return {
    pageUrl,
    parsed: extractImageUrlFromPageHtml(html, config.saveOriginalImages),
    reloadUrl: reloadUrl && reloadUrl !== pageUrl ? reloadUrl : null,
  };
};

const resolveImagePageCandidate = async (
  config: Config,
  imagePageUrl: string
): Promise<ImagePageCandidate> => {
  const candidate = await fetchImagePageCandidate(config, imagePageUrl);
  if (candidate.parsed || !candidate.reloadUrl) return candidate;
  return fetchImagePageCandidate(config, candidate.reloadUrl);
};

const resolveReloadedImagePageCandidate = async (
  config: Config,
  candidate: ImagePageCandidate
): Promise<ImagePageCandidate | null> => {
  if (!candidate.reloadUrl) return null;

  try {
    const reloaded = await fetchImagePageCandidate(config, candidate.reloadUrl);
    return reloaded.parsed ? reloaded : null;
  } catch (error) {
    console.warn('reload image page with nl failed@', error);
    return null;
  }
};

const downloadResolvedImage = async (
  config: Config,
  params: RuntimeJobParams,
  imageParsed: ParsedImageUrl,
  imagePageUrl: string,
  currentIndex: number
) => {
  if (config.saveOriginalImages && imageParsed.source === 'preview') {
    console.warn(
      `original image unavailable, using preview@ index=${currentIndex} page=${imagePageUrl}`
    );
  }

  const sourceImageUrl = imageParsed.url;
  const directFileDownload = needsFileDownload(config) && !needsImageBlob(config);

  if (directFileDownload) {
    await probeImageUrl(sourceImageUrl);
    await startChromeFileDownload(
      config,
      params,
      sourceImageUrl,
      currentIndex,
      resolveDownloadExt(sourceImageUrl),
      sourceImageUrl
    );
    return;
  }

  const { blob, ext } = await resolveImageBlob(sourceImageUrl, config.imageFormat);

  if (needsCbzCache(config)) {
    try {
      await putCbzImage(params.taskId, currentIndex, blob, ext, sourceImageUrl);
    } catch (e) {
      console.error('cbz cache failed@', e);
      await markImageFailed(
        params.taskId,
        params.galleryFrontPageUrl,
        currentIndex,
        'Failed to cache image for CBZ',
        sourceImageUrl
      );
      return;
    }
  }

  if (needsFileDownload(config)) {
    const { url, revoke } = await createDownloadUrl(blob);
    await startChromeFileDownload(config, params, sourceImageUrl, currentIndex, ext, url, revoke);
    return;
  }

  await markImageComplete(params.taskId, params.galleryFrontPageUrl, currentIndex, sourceImageUrl);
};

const downloadImage = async (
  config: Config,
  params: RuntimeJobParams,
  imagePageUrl: string,
  currentIndex: number
) => {
  if (cancelRequested) return;

  let candidate: ImagePageCandidate;
  try {
    candidate = await resolveImagePageCandidate(config, imagePageUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch image page';
    await markImageFailed(
      params.taskId,
      params.galleryFrontPageUrl,
      currentIndex,
      msg,
      imagePageUrl
    );
    return;
  }

  if (!candidate.parsed) {
    await markImageFailed(
      params.taskId,
      params.galleryFrontPageUrl,
      currentIndex,
      'Could not parse image URL',
      candidate.pageUrl
    );
    return;
  }

  try {
    await downloadResolvedImage(config, params, candidate.parsed, candidate.pageUrl, currentIndex);
    return;
  } catch (e) {
    const reloaded = await resolveReloadedImagePageCandidate(config, candidate);
    if (reloaded?.parsed) {
      try {
        await downloadResolvedImage(
          config,
          params,
          reloaded.parsed,
          reloaded.pageUrl,
          currentIndex
        );
        return;
      } catch (retryError) {
        const msg = retryError instanceof Error ? retryError.message : 'Failed to fetch image';
        await markImageFailed(
          params.taskId,
          params.galleryFrontPageUrl,
          currentIndex,
          msg,
          reloaded.parsed.url
        );
        return;
      }
    }

    const msg = e instanceof Error ? e.message : 'Failed to fetch image';
    await markImageFailed(
      params.taskId,
      params.galleryFrontPageUrl,
      currentIndex,
      msg,
      candidate.parsed.url
    );
  }
};

const hasCompletedInCurrentTask = async (params: RuntimeJobParams, currentIndex: number) => {
  const records = await galleryRecordsStorage.get();
  const image = records?.[params.galleryFrontPageUrl]?.images[String(currentIndex)];
  return image?.taskId === params.taskId && image.state === 'complete';
};

const cancelChromeDownloadIfActive = async (chromeDownloadId: number) => {
  try {
    const [item] = await chrome.downloads.search({ id: chromeDownloadId });
    if (!item || item.state === 'complete' || item.state === 'interrupted') return;
    await chrome.downloads.cancel(chromeDownloadId);
  } catch {
    /* The download may have already disappeared or settled. */
  }
};

const cancelInProgressDownloadsForRetry = async (params: RuntimeJobParams, indices: number[]) => {
  const records = await galleryRecordsStorage.get();
  const gallery = records?.[params.galleryFrontPageUrl];
  if (!gallery) return;

  await Promise.all(
    indices.map(async (index) => {
      const image = gallery.images[String(index)];
      if (!image || image.state !== 'in_progress') return;
      if (image.taskId && image.taskId !== params.taskId) return;

      const chromeDownloadId = image.chromeDownloadId;
      await galleryRecordsStorage.upsertImage(params.galleryFrontPageUrl, {
        index,
        sourceUrl: image.sourceUrl ?? '',
        taskId: params.taskId,
        state: 'in_progress',
        updatedAt: Date.now(),
      });

      if (typeof chromeDownloadId === 'number') {
        await cancelChromeDownloadIfActive(chromeDownloadId);
      }
    })
  );
};

const downloadImageIfNeeded = async (
  config: Config,
  params: RuntimeJobParams,
  imagePageUrl: string,
  currentIndex: number
) => {
  if (await hasCompletedInCurrentTask(params, currentIndex)) return;
  await downloadImage(config, params, imagePageUrl, currentIndex);
};

const runSingleDownload = async (
  jobId: number,
  config: Config,
  params: RuntimeJobParams,
  imagePageUrl: string,
  currentIndex: number
) => {
  await acquireDownloadSlot();
  try {
    if (cancelRequested || currentJobId !== jobId) return;
    await downloadImageIfNeeded(config, params, imagePageUrl, currentIndex);
  } finally {
    releaseDownloadSlot();
  }
};

const processGalleryPage = async (
  jobId: number,
  config: Config,
  params: RuntimeJobParams,
  pageIndex: number,
  indicesOnPage: number[]
): Promise<Promise<void>[]> => {
  const launchedDownloads: Promise<void>[] = [];
  if (cancelRequested || indicesOnPage.length === 0) return launchedDownloads;

  const pageUrl =
    pageIndex === 0 ? params.galleryFrontPageUrl : `${params.galleryFrontPageUrl}?p=${pageIndex}`;

  let pageHtml: string;
  try {
    const res = await authFetch(pageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pageHtml = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch gallery page';
    for (const i of indicesOnPage) {
      await markImageFailed(params.taskId, params.galleryFrontPageUrl, i, msg);
    }
    return launchedDownloads;
  }

  const imagePageUrls = extractImagePageUrlsFromHtml(pageHtml);
  if (imagePageUrls.length === 0) {
    for (const i of indicesOnPage) {
      await markImageFailed(params.taskId, params.galleryFrontPageUrl, i, 'No image links on page');
    }
    return launchedDownloads;
  }

  const interval = Math.max(0, config.downloadInterval);
  for (const currentIndex of indicesOnPage) {
    if (cancelRequested) return launchedDownloads;
    const imageIndex = (currentIndex - 1) % params.imagesPerPage;
    const imagePageUrl = imagePageUrls[imageIndex];
    if (!imagePageUrl) {
      await markImageFailed(
        params.taskId,
        params.galleryFrontPageUrl,
        currentIndex,
        'Image link out of range'
      );
      continue;
    }

    launchedDownloads.push(
      runSingleDownload(jobId, config, params, imagePageUrl, currentIndex).catch(async (error) => {
        console.error('download image failed@', error);
        const msg = error instanceof Error ? error.message : 'Unexpected download error';
        await markImageFailed(
          params.taskId,
          params.galleryFrontPageUrl,
          currentIndex,
          msg,
          imagePageUrl
        );
      })
    );

    if (interval > 0) await sleep(interval);
  }

  return launchedDownloads;
};

const groupIndicesByPage = (indices: number[], imagesPerPage: number) => {
  const map = new Map<number, number[]>();
  for (const idx of indices) {
    const page = Math.floor((idx - 1) / imagesPerPage);
    const list = map.get(page) ?? [];
    list.push(idx);
    map.set(page, list);
  }
  return [...map.entries()].sort(([a], [b]) => a - b);
};

const buildRuntimeJobParams = (
  params: JobParams,
  taskId: string,
  reusableTask: ActiveDownloadTask | null
): RuntimeJobParams => {
  if (!reusableTask) return { ...params, taskId };

  return {
    ...params,
    taskId,
    galleryFrontPageUrl: reusableTask.galleryUrl,
    galleryName: reusableTask.galleryName,
    galleryId: reusableTask.galleryId,
    downloadPath: reusableTask.downloadPath,
    rangeStart: reusableTask.rangeStart,
    rangeEnd: reusableTask.rangeEnd,
    imagesPerPage: reusableTask.imagesPerPage,
    numPages: reusableTask.numPages,
    totalImages: reusableTask.totalImages,
  };
};

export const runDownloadJob = async (params: JobParams) => {
  cancelRequested = false;
  const jobId = ++currentJobId;
  resetDownloadSemaphore();
  const config = await configStorage.get();
  setDownloadConcurrency(MAX_CONCURRENT_DOWNLOADS);
  const mode: DownloadJobMode = params.mode ?? 'full';
  const downloadIndices =
    params.indices && params.indices.length > 0
      ? [...new Set(params.indices)].sort((a, b) => a - b)
      : rangeIndices(params.rangeStart, params.rangeEnd);
  const existingTask = await downloadTaskStorage.get();
  const reusableTask =
    mode === 'retry' &&
    params.taskId &&
    existingTask?.taskId === params.taskId &&
    existingTask.galleryUrl === params.galleryFrontPageUrl
      ? existingTask
      : null;
  const taskId = reusableTask?.taskId ?? `${Date.now()}`;
  const taskTargetIndices = reusableTask
    ? reusableTask.targetIndices ?? rangeIndices(reusableTask.rangeStart, reusableTask.rangeEnd)
    : downloadIndices;
  const expectedCount = reusableTask?.expectedCount ?? downloadIndices.length;
  const now = Date.now();
  const jobParams = buildRuntimeJobParams(params, taskId, reusableTask);

  if (mode === 'retry') {
    await cancelInProgressDownloadsForRetry(jobParams, downloadIndices);
  }

  await downloadTaskStorage.set({
    taskId,
    mode,
    status: 'running',
    galleryUrl: jobParams.galleryFrontPageUrl,
    galleryName: jobParams.galleryName,
    galleryId: jobParams.galleryId,
    downloadPath: jobParams.downloadPath,
    rangeStart: jobParams.rangeStart,
    rangeEnd: jobParams.rangeEnd,
    imagesPerPage: jobParams.imagesPerPage,
    numPages: jobParams.numPages,
    totalImages: jobParams.totalImages,
    expectedCount,
    targetIndices: taskTargetIndices,
    queueFailedCount: 0,
    cbzPacked: false,
    startedAt: reusableTask?.startedAt ?? now,
    updatedAt: now,
  });

  await galleryRecordsStorage.markImagesQueued(
    jobParams.galleryFrontPageUrl,
    downloadIndices,
    taskId
  );

  const launchedDownloads: Promise<void>[] = [];

  for (const [pageIndex, pageIndices] of groupIndicesByPage(
    downloadIndices,
    jobParams.imagesPerPage
  )) {
    if (cancelRequested) {
      await Promise.allSettled(launchedDownloads);
      if (currentJobId === jobId) {
        await patchTask({ status: 'cancelled' });
        await clearCbzTask(taskId);
      }
      return;
    }
    const pageDownloads = await processGalleryPage(
      jobId,
      config,
      jobParams,
      pageIndex,
      pageIndices
    );
    launchedDownloads.push(...pageDownloads);
  }

  await Promise.allSettled(launchedDownloads);

  if (cancelRequested) {
    if (currentJobId === jobId) {
      await patchTask({ status: 'cancelled' });
      await clearCbzTask(taskId);
    }
    return;
  }

  // 被更新的 job 取代（如 retry），不再回写 task，避免覆盖新任务状态
  if (currentJobId !== jobId) return;

  await patchTask({ status: 'dispatch_complete' });
  await finalizeTask(jobParams.galleryFrontPageUrl);
};
