import { putCbzImage } from '@/download/cbz-cache';
import {
  buildStorageRelativeFilename,
  consumePendingDownloadFilename,
  enqueuePendingDownloadFilename,
} from '@/download/download-filename';
import { rangeIndices } from '@/download/helpers';
import {
  clearActiveTask,
  completeImage,
  ensureSettledIfAlreadyDone,
  failImage,
  markDispatchComplete,
  markImageInProgress,
  registerChromeDownload,
  startTask,
} from '@/download/state-store';
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
let currentJobId = 0;

const isCurrentDownloadJob = (jobId: number) => !cancelRequested && currentJobId === jobId;

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

/** 已移交给 chrome download 的并发槽（由 top-level downloads.onChanged 在下载终态时释放） */
const activeSlotIds = new Set<number>();

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
  activeSlotIds.clear();
};

const needsCbzCache = (config: Config) => (config.outputMode ?? 'files') !== 'files';
const needsFileDownload = (config: Config) => (config.outputMode ?? 'files') !== 'cbz';
const needsImageBlob = (config: Config) =>
  needsCbzCache(config) ||
  config.saveOriginalImages ||
  Boolean(config.imageFormat && config.imageFormat !== 'original');

export const releaseChromeDownloadSlot = (chromeDownloadId: number) => {
  if (activeSlotIds.delete(chromeDownloadId)) {
    releaseDownloadSlot();
  }
};

const startChromeFileDownload = async (
  jobId: number,
  config: Config,
  params: RuntimeJobParams,
  sourceImageUrl: string,
  currentIndex: number,
  ext: string,
  downloadUrl: string,
  revoke: (() => void) | undefined,
  handOverSlot: (chromeDownloadId: number) => void
) => {
  const filenameHint = {
    downloadPath: params.downloadPath,
    index: currentIndex,
    total: params.totalImages,
    ext,
    sourceUrl: sourceImageUrl,
  };
  const relativeFilename = buildStorageRelativeFilename(config, filenameHint);
  await enqueuePendingDownloadFilename(downloadUrl, {
    ...filenameHint,
    taskId: params.taskId,
    galleryUrl: params.galleryFrontPageUrl,
    filename: relativeFilename,
  });

  if (!isCurrentDownloadJob(jobId)) {
    await consumePendingDownloadFilename(downloadUrl);
    revoke?.();
    return;
  }

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
            await consumePendingDownloadFilename(downloadUrl);
            revoke?.();
            await failImage(
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
            const registered = await registerChromeDownload({
              id,
              index: currentIndex,
              total: params.totalImages,
              downloadPath: params.downloadPath,
              galleryUrl: params.galleryFrontPageUrl,
              sourceUrl: sourceImageUrl,
              taskId: params.taskId,
              filename: relativeFilename,
            });
            // 仅注册成功才消费 hint，失败时留给 onCreated 重试
            if (registered) {
              await consumePendingDownloadFilename(downloadUrl);
            }
            releaseDownloadUrlOnDownloadDone(id, revoke);
            handOverSlot(id);
            if (registered) {
              const settled = await ensureSettledIfAlreadyDone(id);
              if (settled) releaseChromeDownloadSlot(id);
            }
          } catch (error) {
            console.error('register download failed@', error);
            await consumePendingDownloadFilename(downloadUrl);
            revoke?.();
            await failImage(
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
  jobId: number,
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

  if (!isCurrentDownloadJob(jobId)) return;

  const sourceImageUrl = imageParsed.url;
  const owned = await markImageInProgress(
    params.taskId,
    params.galleryFrontPageUrl,
    currentIndex,
    sourceImageUrl
  );
  if (!owned || !isCurrentDownloadJob(jobId)) return;

  await acquireDownloadSlot();
  let slotHandedOver = false;
  const handOverSlot = (chromeDownloadId: number) => {
    slotHandedOver = true;
    activeSlotIds.add(chromeDownloadId);
  };

  try {
    if (!isCurrentDownloadJob(jobId)) return;

    const directFileDownload = needsFileDownload(config) && !needsImageBlob(config);

    if (directFileDownload) {
      await probeImageUrl(sourceImageUrl);
      await startChromeFileDownload(
        jobId,
        config,
        params,
        sourceImageUrl,
        currentIndex,
        resolveDownloadExt(sourceImageUrl),
        sourceImageUrl,
        undefined,
        handOverSlot
      );
      return;
    }

    const { blob, ext } = await resolveImageBlob(sourceImageUrl, config.imageFormat);
    if (!isCurrentDownloadJob(jobId)) return;

    if (needsCbzCache(config)) {
      try {
        await putCbzImage(params.taskId, currentIndex, blob, ext, sourceImageUrl);
      } catch (e) {
        console.error('cbz cache failed@', e);
        await failImage(
          params.taskId,
          params.galleryFrontPageUrl,
          currentIndex,
          'Failed to cache image for CBZ',
          sourceImageUrl
        );
        return;
      }
      if (!isCurrentDownloadJob(jobId)) return;
    }

    if (needsFileDownload(config)) {
      const { url, revoke } = await createDownloadUrl(blob);
      await startChromeFileDownload(
        jobId,
        config,
        params,
        sourceImageUrl,
        currentIndex,
        ext,
        url,
        revoke,
        handOverSlot
      );
      return;
    }

    if (!isCurrentDownloadJob(jobId)) return;
    await completeImage(params.taskId, params.galleryFrontPageUrl, currentIndex, sourceImageUrl);
  } finally {
    if (!slotHandedOver) releaseDownloadSlot();
  }
};

const downloadImage = async (
  jobId: number,
  config: Config,
  params: RuntimeJobParams,
  imagePageUrl: string,
  currentIndex: number
) => {
  if (!isCurrentDownloadJob(jobId)) return;

  let candidate: ImagePageCandidate;
  try {
    candidate = await resolveImagePageCandidate(config, imagePageUrl);
  } catch (e) {
    if (!isCurrentDownloadJob(jobId)) return;
    const msg = e instanceof Error ? e.message : 'Failed to fetch image page';
    await failImage(params.taskId, params.galleryFrontPageUrl, currentIndex, msg, imagePageUrl);
    return;
  }

  if (!isCurrentDownloadJob(jobId)) return;

  if (!candidate.parsed) {
    await failImage(
      params.taskId,
      params.galleryFrontPageUrl,
      currentIndex,
      'Could not parse image URL',
      candidate.pageUrl
    );
    return;
  }

  try {
    await downloadResolvedImage(
      jobId,
      config,
      params,
      candidate.parsed,
      candidate.pageUrl,
      currentIndex
    );
    return;
  } catch (e) {
    const reloaded = await resolveReloadedImagePageCandidate(config, candidate);
    if (!isCurrentDownloadJob(jobId)) return;
    if (reloaded?.parsed) {
      try {
        await downloadResolvedImage(
          jobId,
          config,
          params,
          reloaded.parsed,
          reloaded.pageUrl,
          currentIndex
        );
        return;
      } catch (retryError) {
        if (!isCurrentDownloadJob(jobId)) return;
        const msg = retryError instanceof Error ? retryError.message : 'Failed to fetch image';
        await failImage(
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
    await failImage(
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
      if (typeof chromeDownloadId === 'number') {
        await cancelChromeDownloadIfActive(chromeDownloadId);
      }
    })
  );
};

const downloadImageIfNeeded = async (
  jobId: number,
  config: Config,
  params: RuntimeJobParams,
  imagePageUrl: string,
  currentIndex: number
) => {
  if (await hasCompletedInCurrentTask(params, currentIndex)) return;
  if (!isCurrentDownloadJob(jobId)) return;
  await downloadImage(jobId, config, params, imagePageUrl, currentIndex);
};

const runSingleDownload = async (
  jobId: number,
  config: Config,
  params: RuntimeJobParams,
  imagePageUrl: string,
  currentIndex: number
) => {
  if (!isCurrentDownloadJob(jobId)) return;
  await downloadImageIfNeeded(jobId, config, params, imagePageUrl, currentIndex);
};

const processGalleryPage = async (
  jobId: number,
  config: Config,
  params: RuntimeJobParams,
  pageIndex: number,
  indicesOnPage: number[]
): Promise<Promise<void>[]> => {
  const launchedDownloads: Promise<void>[] = [];
  if (!isCurrentDownloadJob(jobId) || indicesOnPage.length === 0) return launchedDownloads;

  const pageUrl =
    pageIndex === 0 ? params.galleryFrontPageUrl : `${params.galleryFrontPageUrl}?p=${pageIndex}`;

  let pageHtml: string;
  try {
    const res = await authFetch(pageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pageHtml = await res.text();
  } catch (e) {
    if (!isCurrentDownloadJob(jobId)) return launchedDownloads;
    const msg = e instanceof Error ? e.message : 'Failed to fetch gallery page';
    for (const i of indicesOnPage) {
      if (!isCurrentDownloadJob(jobId)) return launchedDownloads;
      await failImage(params.taskId, params.galleryFrontPageUrl, i, msg);
    }
    return launchedDownloads;
  }

  if (!isCurrentDownloadJob(jobId)) return launchedDownloads;

  const imagePageUrls = extractImagePageUrlsFromHtml(pageHtml);
  if (imagePageUrls.length === 0) {
    for (const i of indicesOnPage) {
      if (!isCurrentDownloadJob(jobId)) return launchedDownloads;
      await failImage(params.taskId, params.galleryFrontPageUrl, i, 'No image links on page');
    }
    return launchedDownloads;
  }

  const interval = Math.max(0, config.downloadInterval);
  for (const currentIndex of indicesOnPage) {
    if (!isCurrentDownloadJob(jobId)) return launchedDownloads;
    const imageIndex = (currentIndex - 1) % params.imagesPerPage;
    const imagePageUrl = imagePageUrls[imageIndex];
    if (!imagePageUrl) {
      await failImage(
        params.taskId,
        params.galleryFrontPageUrl,
        currentIndex,
        'Image link out of range'
      );
      continue;
    }

    launchedDownloads.push(
      runSingleDownload(jobId, config, params, imagePageUrl, currentIndex).catch(async (error) => {
        if (!isCurrentDownloadJob(jobId)) return;
        console.error('download image failed@', error);
        const msg = error instanceof Error ? error.message : 'Unexpected download error';
        await failImage(params.taskId, params.galleryFrontPageUrl, currentIndex, msg, imagePageUrl);
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
  if (!isCurrentDownloadJob(jobId)) return;
  setDownloadConcurrency(MAX_CONCURRENT_DOWNLOADS);
  const mode: DownloadJobMode = params.mode ?? 'full';
  const downloadIndices =
    params.indices && params.indices.length > 0
      ? [...new Set(params.indices)].sort((a, b) => a - b)
      : rangeIndices(params.rangeStart, params.rangeEnd);
  const existingTask = await downloadTaskStorage.get();
  if (!isCurrentDownloadJob(jobId)) return;
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
    if (!isCurrentDownloadJob(jobId)) return;
  }

  await startTask({
    taskId,
    mode,
    galleryName: jobParams.galleryName,
    galleryId: jobParams.galleryId,
    galleryFrontPageUrl: jobParams.galleryFrontPageUrl,
    downloadPath: jobParams.downloadPath,
    rangeStart: jobParams.rangeStart,
    rangeEnd: jobParams.rangeEnd,
    imagesPerPage: jobParams.imagesPerPage,
    numPages: jobParams.numPages,
    totalImages: jobParams.totalImages,
    expectedCount,
    targetIndices: taskTargetIndices,
    queuedIndices: downloadIndices,
    startedAt: reusableTask?.startedAt ?? now,
  });
  if (!isCurrentDownloadJob(jobId)) return;

  const launchedDownloads: Promise<void>[] = [];

  for (const [pageIndex, pageIndices] of groupIndicesByPage(
    downloadIndices,
    jobParams.imagesPerPage
  )) {
    if (cancelRequested) {
      await Promise.allSettled(launchedDownloads);
      if (currentJobId === jobId) {
        await clearActiveTask(taskId);
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
      await clearActiveTask(taskId);
    }
    return;
  }

  // 被更新的 job 取代（如 retry），不再回写 task，避免覆盖新任务状态
  if (currentJobId !== jobId) return;

  await markDispatchComplete(taskId, jobParams.galleryFrontPageUrl);
};
