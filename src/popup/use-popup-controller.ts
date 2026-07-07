import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  cancelDownload,
  resumeDownload,
  retryFailedDownload,
  startDownload,
} from '@/download/client';
import { resolveGalleryDownloadPath } from '@/download/download-filename';
import {
  computeFailedIndices,
  computeMissingIndices,
  computeRetryableIndices,
} from '@/download/helpers';
import type { DownloadJobPayload } from '@/download/types';
import { useLatest, useMounted, useStateRef, useStorage, useStorageSuspense } from '@/hooks';
import {
  type ActiveDownloadTask,
  configStorage,
  downloadHistoryStorage,
  downloadTaskStorage,
  type GalleryInfo,
  galleryRecordsStorage,
} from '@/storage';
import {
  DEFAULT_CONFIG,
  getCurrentTabHtml,
  getCurrentTabUrl,
  isEHentaiGalleryUrl,
  isEHentaiPageUrl,
} from '@/utils';
import {
  downloadAsTxtFile,
  extractGalleryInfo,
  extractGalleryPageInfo,
  formatGalleryInfoTxt,
  isGalleryPageHtml,
} from '@/utils';
import { t } from '@/utils/i18n';

import { countIndicesProgress, countRangeProgress } from './lib/progress';
import { derivePopupViewModel } from './lib/view-model';
import { StatusEnum } from './status';

export const usePopupController = () => {
  const [pageStatus, setPageStatus] = useState<StatusEnum>(StatusEnum.Loading);
  const [optimisticTaskStatus, setOptimisticTaskStatus] = useState<StatusEnum.Downloading | null>(
    null
  );
  const galleryRecords = useStorageSuspense(galleryRecordsStorage) || {};
  const activeTask = useStorage(downloadTaskStorage);
  const galleryFrontPageUrl = useRef('');
  const [selectedTab, setSelectedTab] = useState('info');
  const config = useStorage(configStorage);
  const configLatest = useLatest(config || DEFAULT_CONFIG);
  const [galleryDetailOpen, setGalleryDetailOpen] = useState(false);
  const [galleryPageInfo, setGalleryPageInfo, galleryPageInfoRef] = useStateRef({
    imagesPerPage: 0,
    numPages: 0,
    totalImages: 0,
  });
  const [galleryInfo, setGalleryInfo] = useState<GalleryInfo | null>(null);
  const [range, setRange] = useState<[number, number]>([1, galleryPageInfo.totalImages]);
  const currentGalleryUrl = galleryFrontPageUrl.current;
  const currentTask: ActiveDownloadTask | null =
    activeTask?.galleryUrl === currentGalleryUrl ? activeTask : null;

  useEffect(() => {
    setRange([1, galleryPageInfo.totalImages]);
  }, [galleryPageInfo.totalImages]);

  const downloadCount = range[1] - range[0] + 1;
  const viewModel = useMemo(
    () =>
      derivePopupViewModel({
        pageStatus,
        optimisticTaskStatus,
        activeTask,
        galleryUrl: currentGalleryUrl,
        range,
        downloadCount,
      }),
    [activeTask, currentGalleryUrl, downloadCount, optimisticTaskStatus, pageStatus, range]
  );
  const {
    status,
    isTaskForCurrentGallery,
    isCenteredStatus,
    isSelfScrollingLayout,
    isDownloading,
    progressRange,
    progressTotal,
    taskDisplayRange,
    taskDisplayRangeLabel,
    taskDisplayTotal,
  } = viewModel;

  useEffect(() => {
    if (optimisticTaskStatus && isTaskForCurrentGallery) {
      setOptimisticTaskStatus(null);
    }
  }, [isTaskForCurrentGallery, optimisticTaskStatus]);

  const { completeCount, failedCount, inProgressCount } = useMemo(() => {
    const record = galleryRecords[currentGalleryUrl];
    if (currentTask?.targetIndices?.length) {
      return countIndicesProgress(record, currentTask.targetIndices, currentTask.taskId);
    }
    if (optimisticTaskStatus === StatusEnum.Downloading) {
      return { completeCount: 0, failedCount: 0, inProgressCount: 0 };
    }
    return countRangeProgress(record, progressRange.start, progressRange.end);
  }, [
    galleryRecords,
    currentGalleryUrl,
    currentTask,
    optimisticTaskStatus,
    progressRange.start,
    progressRange.end,
  ]);

  const buildJobPayload = (
    indices?: number[],
    rangeOverride?: [number, number],
    taskId?: string
  ): DownloadJobPayload => {
    const r = rangeOverride ?? range;
    return {
      galleryFrontPageUrl: galleryFrontPageUrl.current,
      galleryName: galleryInfo?.name ?? '',
      galleryId: galleryInfo?.id ?? '',
      downloadPath: resolveGalleryDownloadPath(
        configLatest.current.intermediateDownloadPath,
        galleryInfo?.name ?? ''
      ),
      rangeStart: r[0],
      rangeEnd: r[1],
      imagesPerPage: galleryPageInfoRef.current.imagesPerPage,
      numPages: galleryPageInfoRef.current.numPages,
      totalImages: galleryPageInfoRef.current.totalImages,
      indices,
      taskId,
    };
  };

  const launchDownload = async (
    mode: 'full' | 'resume' | 'retry',
    indices?: number[],
    rangeOverride?: [number, number]
  ) => {
    if (!galleryInfo) return false;
    setOptimisticTaskStatus(StatusEnum.Downloading);

    const payload = buildJobPayload(
      indices,
      rangeOverride,
      mode === 'retry' ? currentTask?.taskId : undefined
    );
    const fn =
      mode === 'resume' ? resumeDownload : mode === 'retry' ? retryFailedDownload : startDownload;
    const response = await fn(payload);

    if (!response?.ok) {
      toast.error(t('failedStartDownload'));
      setOptimisticTaskStatus(null);
      setPageStatus(StatusEnum.BeforeDownload);
      return false;
    }

    if (mode === 'full' && configLatest.current.saveGalleryInfo) {
      downloadAsTxtFile(formatGalleryInfoTxt(galleryInfo, galleryFrontPageUrl.current));
    }
    return true;
  };

  const handleStartDownload = async (rangeOverride?: [number, number]) => {
    if (!galleryInfo) return;
    const downloadRange = rangeOverride ?? range;
    if (rangeOverride) setRange(rangeOverride);

    try {
      await downloadHistoryStorage.add({
        url: galleryFrontPageUrl.current,
        name: galleryInfo.name,
        range: downloadRange,
        info: galleryInfo,
      });
    } catch (e) {
      console.error('add download history failed@', e);
      toast.error(t('failedSaveHistory'));
    }
    await launchDownload('full', undefined, downloadRange);
  };

  const handleResumeMissing = async () => {
    const record = galleryRecords[currentGalleryUrl];
    const missing = computeMissingIndices(record, range[0], range[1]);
    if (missing.length === 0) {
      toast.info(t('nothingToResume'));
      return;
    }
    await launchDownload('resume', missing);
  };

  const handleRetryFailed = async (indices?: number[], options: { closeDetail?: boolean } = {}) => {
    const record = galleryRecords[currentGalleryUrl];
    const failed =
      indices ??
      computeFailedIndices(record, progressRange.start, progressRange.end, {
        taskId: currentTask?.taskId,
        indices: currentTask?.targetIndices,
      });
    if (failed.length === 0) {
      toast.info(t('noFailedItems'));
      return;
    }

    const launched = await launchDownload('retry', failed);
    if (!launched) return;

    if (options.closeDetail) setGalleryDetailOpen(false);
  };

  const handleRetryUnfinished = async () => {
    if (!currentTask) {
      toast.info(t('noUnfinishedItems'));
      return;
    }

    const record = galleryRecords[currentGalleryUrl];
    const retryable = computeRetryableIndices(record, progressRange.start, progressRange.end, {
      taskId: currentTask.taskId,
      indices: currentTask.targetIndices,
    });

    if (retryable.length === 0) {
      toast.info(t('noUnfinishedItems'));
      return;
    }

    await launchDownload('retry', retryable);
  };

  const initFromCurrentTab = async () => {
    setOptimisticTaskStatus(null);
    setPageStatus(StatusEnum.Loading);
    const url = await getCurrentTabUrl().catch(() => '');
    if (!isEHentaiGalleryUrl(url)) {
      setPageStatus(isEHentaiPageUrl(url) ? StatusEnum.EHentaiOther : StatusEnum.OtherPage);
      return;
    }

    const items = configLatest.current ?? DEFAULT_CONFIG;
    configLatest.current = items;

    const trimmed = url.split('?')[0];
    galleryFrontPageUrl.current = trimmed.substring(0, trimmed.lastIndexOf('/') + 1);
    const galleryHtmlStr = await getCurrentTabHtml().catch(() => '');
    if (!isGalleryPageHtml(galleryHtmlStr)) {
      setPageStatus(StatusEnum.Fail);
      return;
    }

    const pageInfo = extractGalleryPageInfo(galleryHtmlStr);
    setGalleryPageInfo(pageInfo);
    const galleryInfoResult = await extractGalleryInfo(galleryHtmlStr);
    setGalleryInfo(galleryInfoResult);

    setPageStatus(StatusEnum.BeforeDownload);
  };

  useMounted(() => {
    void initFromCurrentTab();
  });

  const resetToBeforeDownload = async () => {
    if (activeTask?.galleryUrl === galleryFrontPageUrl.current) {
      setRange([activeTask.rangeStart, activeTask.rangeEnd]);
    }
    await downloadTaskStorage.set(null);
    setOptimisticTaskStatus(null);
    setPageStatus(StatusEnum.BeforeDownload);
  };

  const handleCancelDownload = async () => {
    await cancelDownload();
    await resetToBeforeDownload();
    toast.info(t('downloadCancelled'));
  };

  const openDownloadFolder = () => {
    chrome.downloads.showDefaultFolder();
  };

  const getGalleryUrl = () => galleryFrontPageUrl.current;

  const tabContentClassName = `scrollbar-glass h-full min-h-0 w-full overflow-x-hidden ${
    isCenteredStatus
      ? 'flex flex-col items-center justify-center px-4 py-2 -translate-y-4'
      : isSelfScrollingLayout
        ? 'flex min-h-0 flex-col overflow-hidden'
        : 'overflow-y-auto'
  }`;

  const pathPreview = galleryInfo
    ? resolveGalleryDownloadPath(
        (config || DEFAULT_CONFIG).intermediateDownloadPath,
        galleryInfo.name
      )
    : undefined;

  return {
    status,
    selectedTab,
    setSelectedTab,
    galleryDetailOpen,
    setGalleryDetailOpen,
    galleryInfo,
    galleryPageInfo,
    galleryRecords,
    currentTask,
    range,
    setRange,
    downloadCount,
    completeCount,
    failedCount,
    inProgressCount,
    progressTotal,
    taskDisplayRange,
    taskDisplayRangeLabel,
    taskDisplayTotal,
    isDownloading,
    tabContentClassName,
    pathPreview,
    config,
    getGalleryUrl,
    reloadGallery: () => void initFromCurrentTab(),
    handleStartDownload: () => void handleStartDownload(),
    handleResumeMissing: () => void handleResumeMissing(),
    handleRetryFailed: (indices?: number[], options?: { closeDetail?: boolean }) =>
      void handleRetryFailed(indices, options),
    handleRetryUnfinished: () => void handleRetryUnfinished(),
    handleCancelDownload: () => void handleCancelDownload(),
    resetToBeforeDownload: () => void resetToBeforeDownload(),
    openDownloadFolder,
  };
};

export type PopupController = ReturnType<typeof usePopupController>;
