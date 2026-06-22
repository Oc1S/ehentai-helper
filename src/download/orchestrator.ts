import { rangeIndices } from '@/download/helpers';
import type { DownloadJobMode, DownloadJobPayload } from '@/download/types';
import {
  type ActiveDownloadTask,
  configStorage,
  downloadTaskStorage,
  galleryRecordsStorage,
} from '@/storage';
import type { Config } from '@/utils';
import {
  extractImagePageUrlsFromHtml,
  extractImageUrlFromPageHtml,
} from '@/utils/gallery-html-parse';
import { releaseConvertedUrlOnDownloadDone } from '@/utils/image-format';
import { convertImageToFormatInWorker } from '@/utils/image-format-worker';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type JobParams = DownloadJobPayload & {
  mode?: DownloadJobMode;
};

let cancelRequested = false;
let finalizeTimer: ReturnType<typeof setTimeout> | null = null;
let activeTaskId: string | null = null;

export const requestCancelDownload = () => {
  cancelRequested = true;
};

const patchTask = async (patch: Partial<ActiveDownloadTask>) => {
  await downloadTaskStorage.set((prev) => {
    if (!prev) return prev;
    return { ...prev, ...patch, updatedAt: Date.now() };
  });
};

const markImageFailed = async (
  galleryUrl: string,
  index: number,
  error: string,
  sourceUrl = ''
) => {
  await galleryRecordsStorage.upsertImage(galleryUrl, {
    index,
    sourceUrl,
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
  images: Record<string, { state: string }> | undefined
) => {
  let complete = 0;
  let interrupted = 0;
  let inProgress = 0;
  const indices = task.targetIndices ?? rangeIndices(task.rangeStart, task.rangeEnd);

  for (const i of indices) {
    const img = images?.[String(i)];
    if (!img) continue;
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
  if (task.status === 'cancelled' || task.status === 'completed') return;

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
};

export const onGalleryRecordChanged = (galleryUrl: string) => {
  void finalizeTask(galleryUrl);
};

const downloadImage = async (
  config: Config,
  params: JobParams,
  imagePageUrl: string,
  currentIndex: number
) => {
  if (cancelRequested) return;

  let responseText: string;
  try {
    const res = await fetch(imagePageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    responseText = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch image page';
    await markImageFailed(params.galleryFrontPageUrl, currentIndex, msg, imagePageUrl);
    return;
  }

  const imageUrl = extractImageUrlFromPageHtml(responseText, config.saveOriginalImages);
  if (!imageUrl) {
    await markImageFailed(
      params.galleryFrontPageUrl,
      currentIndex,
      'Could not parse image URL',
      imagePageUrl
    );
    return;
  }

  const sourceImageUrl = imageUrl;
  let downloadUrl = imageUrl;
  let convertedObjectUrl: string | null = null;
  const desiredFormat = config.imageFormat;

  if (desiredFormat && desiredFormat !== 'original') {
    try {
      convertedObjectUrl = await convertImageToFormatInWorker(imageUrl, desiredFormat);
      downloadUrl = convertedObjectUrl;
    } catch (e) {
      console.warn('image format convert failed, fallback to original@', e);
    }
  }

  await new Promise<void>((resolve) => {
    chrome.downloads.download({ url: downloadUrl }, (id) => {
      if (chrome.runtime.lastError || typeof id !== 'number') {
        if (convertedObjectUrl) URL.revokeObjectURL(convertedObjectUrl);
        void markImageFailed(
          params.galleryFrontPageUrl,
          currentIndex,
          chrome.runtime.lastError?.message ?? 'Download API rejected request',
          sourceImageUrl
        ).then(resolve);
        return;
      }
      if (convertedObjectUrl) {
        releaseConvertedUrlOnDownloadDone(id, convertedObjectUrl);
      }
      chrome.runtime.sendMessage({
        type: 'register-download-index',
        id,
        index: currentIndex,
        total: params.totalImages,
        downloadPath: params.downloadPath,
        galleryUrl: params.galleryFrontPageUrl,
        sourceUrl: sourceImageUrl,
        taskId: activeTaskId,
      });
      resolve();
    });
  });
};

const processGalleryPage = async (
  config: Config,
  params: JobParams,
  pageIndex: number,
  indicesOnPage: number[]
) => {
  if (cancelRequested || indicesOnPage.length === 0) return;

  const pageUrl =
    pageIndex === 0 ? params.galleryFrontPageUrl : `${params.galleryFrontPageUrl}?p=${pageIndex}`;

  let pageHtml: string;
  try {
    const res = await fetch(pageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pageHtml = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch gallery page';
    for (const i of indicesOnPage) {
      await markImageFailed(params.galleryFrontPageUrl, i, msg);
    }
    return;
  }

  const imagePageUrls = extractImagePageUrlsFromHtml(pageHtml);
  if (imagePageUrls.length === 0) {
    for (const i of indicesOnPage) {
      await markImageFailed(params.galleryFrontPageUrl, i, 'No image links on page');
    }
    return;
  }

  for (const currentIndex of indicesOnPage) {
    if (cancelRequested) return;
    const imageIndex = (currentIndex - 1) % params.imagesPerPage;
    const imagePageUrl = imagePageUrls[imageIndex];
    if (!imagePageUrl) {
      await markImageFailed(params.galleryFrontPageUrl, currentIndex, 'Image link out of range');
      continue;
    }

    await downloadImage(config, params, imagePageUrl, currentIndex);

    const interval = Math.max(0, config.downloadInterval);
    if (interval > 0) await sleep(interval);
  }
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
  const taskId = `${Date.now()}`;
  activeTaskId = taskId;
  const mode: DownloadJobMode = params.mode ?? 'full';
  const indices =
    params.indices && params.indices.length > 0
      ? [...params.indices].sort((a, b) => a - b)
      : rangeIndices(params.rangeStart, params.rangeEnd);
  const expectedCount = indices.length;

  await downloadTaskStorage.set({
    taskId,
    mode,
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
    expectedCount,
    targetIndices: indices,
    queueFailedCount: 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  });

  for (const [pageIndex, pageIndices] of groupIndicesByPage(indices, params.imagesPerPage)) {
    if (cancelRequested) {
      await patchTask({ status: 'cancelled' });
      activeTaskId = null;
      return;
    }
    await processGalleryPage(config, params, pageIndex, pageIndices);
  }

  if (cancelRequested) {
    await patchTask({ status: 'cancelled' });
    activeTaskId = null;
    return;
  }

  await patchTask({ status: 'dispatch_complete' });
  await finalizeTask(params.galleryFrontPageUrl);
  activeTaskId = null;
};
