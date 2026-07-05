import { clearCbzTask, putCbzImage } from '@/download/cbz-cache';
import { packAndDownloadCbz } from '@/download/cbz-pack';
import {
  buildStorageRelativeFilename,
  enqueuePendingDownloadFilename,
} from '@/download/download-filename';
import { registerDownloadIndex } from '@/download/download-registry';
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
  extractImagePageUrlsFromHtml,
  extractImageUrlFromPageHtml,
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

export const requestCancelDownload = () => {
  cancelRequested = true;
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
  enqueuePendingDownloadFilename(filenameHint);
  const relativeFilename = buildStorageRelativeFilename(config, filenameHint);

  await new Promise<void>((resolve) => {
    chrome.downloads.download(
      {
        url: downloadUrl,
        filename: relativeFilename,
        conflictAction: config.filenameConflictAction,
      },
      (id) => {
        void (async () => {
          if (chrome.runtime.lastError || typeof id !== 'number') {
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

const downloadImage = async (
  config: Config,
  params: RuntimeJobParams,
  imagePageUrl: string,
  currentIndex: number
) => {
  if (cancelRequested) return;

  let responseText: string;
  try {
    const res = await authFetch(imagePageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    responseText = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch image page';
    await markImageFailed(params.taskId, params.galleryFrontPageUrl, currentIndex, msg, imagePageUrl);
    return;
  }

  const imageParsed = extractImageUrlFromPageHtml(responseText, config.saveOriginalImages);
  if (!imageParsed) {
    await markImageFailed(
      params.taskId,
      params.galleryFrontPageUrl,
      currentIndex,
      'Could not parse image URL',
      imagePageUrl
    );
    return;
  }

  if (config.saveOriginalImages && imageParsed.source === 'preview') {
    console.warn(
      `original image unavailable, using preview@ index=${currentIndex} page=${imagePageUrl}`
    );
  }

  const sourceImageUrl = imageParsed.url;
  const directFileDownload =
    needsFileDownload(config) && !needsImageBlob(config);

  if (directFileDownload) {
    try {
      await probeImageUrl(sourceImageUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch image';
      await markImageFailed(params.taskId, params.galleryFrontPageUrl, currentIndex, msg, sourceImageUrl);
      return;
    }

    const ext = (() => {
      try {
        const path = new URL(sourceImageUrl).pathname;
        const dot = path.lastIndexOf('.');
        if (dot === -1) return 'jpg';
        return path.slice(dot + 1).toLowerCase() || 'jpg';
      } catch {
        return 'jpg';
      }
    })();
    await startChromeFileDownload(
      config,
      params,
      sourceImageUrl,
      currentIndex,
      ext,
      sourceImageUrl
    );
    return;
  }

  let blob: Blob;
  let ext: string;
  try {
    ({ blob, ext } = await resolveImageBlob(sourceImageUrl, config.imageFormat));
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch image';
    await markImageFailed(params.taskId, params.galleryFrontPageUrl, currentIndex, msg, sourceImageUrl);
    return;
  }

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
    await startChromeFileDownload(
      config,
      params,
      sourceImageUrl,
      currentIndex,
      ext,
      url,
      revoke
    );
    return;
  }

  await markImageComplete(params.taskId, params.galleryFrontPageUrl, currentIndex, sourceImageUrl);
};

const processGalleryPage = async (
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
      downloadImage(config, params, imagePageUrl, currentIndex).catch(async (error) => {
        console.error('download image failed@', error);
        const msg = error instanceof Error ? error.message : 'Unexpected download error';
        await markImageFailed(params.taskId, params.galleryFrontPageUrl, currentIndex, msg, imagePageUrl);
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

export const runDownloadJob = async (params: JobParams) => {
  cancelRequested = false;
  const config = await configStorage.get();
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
    ? (reusableTask.targetIndices ?? rangeIndices(reusableTask.rangeStart, reusableTask.rangeEnd))
    : downloadIndices;
  const expectedCount = reusableTask?.expectedCount ?? downloadIndices.length;
  const now = Date.now();
  const jobParams: RuntimeJobParams = reusableTask
    ? {
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
      }
    : { ...params, taskId };

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

  const launchedDownloads: Promise<void>[] = [];

  for (const [pageIndex, pageIndices] of groupIndicesByPage(
    downloadIndices,
    jobParams.imagesPerPage
  )) {
    if (cancelRequested) {
      await Promise.allSettled(launchedDownloads);
      await patchTask({ status: 'cancelled' });
      await clearCbzTask(taskId);
      return;
    }
    const pageDownloads = await processGalleryPage(config, jobParams, pageIndex, pageIndices);
    launchedDownloads.push(...pageDownloads);
  }

  await Promise.allSettled(launchedDownloads);

  if (cancelRequested) {
    await patchTask({ status: 'cancelled' });
    await clearCbzTask(taskId);
    return;
  }

  await patchTask({ status: 'dispatch_complete' });
  await finalizeTask(jobParams.galleryFrontPageUrl);
};
