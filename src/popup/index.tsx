import '../styles/index.css';
import '../styles/popup.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Link, Progress, Spinner, Tab, Tabs } from '@nextui-org/react';
import { toast } from 'sonner';

import { AppShell } from '@/app';
import { DownloadConfirmModal } from '@/components/download-confirm-modal';
import { DownloadIcon } from '@/components/icons/DownloadIcon';
import { PageSelector } from '@/components/page-selector';
import { StatusCard } from '@/components/status-card';
import {
  cancelDownload,
  resumeDownload,
  retryFailedDownload,
  startDownload,
} from '@/download/client';
import { computeFailedIndices, computeMissingIndices } from '@/download/helpers';
import type { DownloadJobPayload } from '@/download/types';
import { useLatest, useMounted, useStateRef, useStorage, useStorageSuspense } from '@/hooks';
import {
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
  removeInvalidCharFromFilename,
} from '@/utils';
import { t } from '@/utils/i18n';

import { History } from '../components/download-history';
import { DownloadSettings } from '../components/download-settings';
import { DownloadTable } from '../components/download-table';
import { GalleryDetailModal } from '../components/gallery-detail-modal';
import { CheckIcon, CloseIcon, InfoIcon, LinkIcon } from './components/icons';
import { CENTERED_STATUSES, StatusEnum } from './status';

const DownloadProgress = ({
  downloadCount,
  completeCount,
  failedCount,
  inProgressCount,
}: {
  downloadCount: number;
  completeCount: number;
  failedCount: number;
  inProgressCount: number;
}) => {
  const settledCount = completeCount + failedCount;
  const percent = downloadCount > 0 ? Math.round((settledCount / downloadCount) * 100) : 0;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">
            {t('progress')}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-accent">{percent}%</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">
            {t('completed')}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
            {completeCount}
            <span className="text-sm font-medium text-muted"> / {downloadCount}</span>
          </p>
        </div>
      </div>
      <Progress
        aria-label={t('downloadProgress')}
        value={settledCount}
        minValue={0}
        maxValue={downloadCount}
        color="primary"
        size="sm"
      />
      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-soft">
        <span className="text-success">{t('badgeComplete', String(completeCount))}</span>
        <span>·</span>
        <span className="text-warning">{t('badgeInProgress', String(inProgressCount))}</span>
        <span>·</span>
        <span className="text-error">{t('badgeFailed', String(failedCount))}</span>
      </div>
    </div>
  );
};

const countRangeProgress = (
  record: { images: Record<string, { state: string }> } | undefined,
  rangeStart: number,
  rangeEnd: number
) => {
  let completeCount = 0;
  let failedCount = 0;
  let inProgressCount = 0;
  if (!record) return { completeCount, failedCount, inProgressCount };

  for (let i = rangeStart; i <= rangeEnd; i++) {
    const img = record.images[String(i)];
    if (!img) continue;
    if (img.state === 'complete') completeCount++;
    else if (img.state === 'interrupted') failedCount++;
    else if (img.state === 'in_progress') inProgressCount++;
  }
  return { completeCount, failedCount, inProgressCount };
};

const countIndicesProgress = (
  record: { images: Record<string, { state: string }> } | undefined,
  indices: number[]
) => {
  let completeCount = 0;
  let failedCount = 0;
  let inProgressCount = 0;
  for (const i of indices) {
    const img = record?.images[String(i)];
    if (!img) continue;
    if (img.state === 'complete') completeCount++;
    else if (img.state === 'interrupted') failedCount++;
    else if (img.state === 'in_progress') inProgressCount++;
  }
  return { completeCount, failedCount, inProgressCount };
};

const getCurrentPageFromUrl = (url: string) => {
  try {
    const p = new URL(url).searchParams.get('p');
    return p ? Number(p) : 0;
  } catch {
    return 0;
  }
};

const taskStatusToUi = (taskStatus: string): StatusEnum | null => {
  switch (taskStatus) {
    case 'running':
    case 'dispatch_complete':
      return StatusEnum.Downloading;
    case 'completed':
      return StatusEnum.DownloadSuccess;
    case 'partial_success':
      return StatusEnum.DownloadPartialSuccess;
    case 'failed':
      return StatusEnum.DownloadFailed;
    default:
      return null;
  }
};

const Popup = () => {
  const [status, setStatus] = useState<StatusEnum>(StatusEnum.Loading);
  const galleryRecords = useStorageSuspense(galleryRecordsStorage) || {};
  const activeTask = useStorage(downloadTaskStorage);
  const galleryFrontPageUrl = useRef('');
  const tabUrlRef = useRef('');
  const lastNotifiedTaskStatus = useRef<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('info');
  const [currentPage, setCurrentPage] = useState(0);
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

  useEffect(() => {
    setRange([1, galleryPageInfo.totalImages]);
  }, [galleryPageInfo.totalImages]);

  const downloadCount = range[1] - range[0] + 1;
  const progressRange =
    activeTask?.galleryUrl === galleryFrontPageUrl.current
      ? { start: activeTask.rangeStart, end: activeTask.rangeEnd }
      : { start: range[0], end: range[1] };

  const { completeCount, failedCount, inProgressCount } = useMemo(() => {
    const record = galleryRecords[galleryFrontPageUrl.current];
    if (
      activeTask?.galleryUrl === galleryFrontPageUrl.current &&
      activeTask.targetIndices?.length
    ) {
      return countIndicesProgress(record, activeTask.targetIndices);
    }
    return countRangeProgress(record, progressRange.start, progressRange.end);
  }, [galleryRecords, activeTask, progressRange.start, progressRange.end]);

  const progressTotal =
    activeTask?.galleryUrl === galleryFrontPageUrl.current
      ? activeTask.expectedCount
      : downloadCount;

  useEffect(() => {
    if (!activeTask || activeTask.galleryUrl !== galleryFrontPageUrl.current) return;
    const next = taskStatusToUi(activeTask.status);
    if (next === null) return;
    setStatus(next);
    if (lastNotifiedTaskStatus.current === activeTask.status) return;
    if (activeTask.status === 'partial_success') {
      toast.warning(t('partialSuccessToast', [String(completeCount), String(failedCount)]));
      lastNotifiedTaskStatus.current = activeTask.status;
    } else if (activeTask.status === 'failed') {
      toast.error(t('downloadFailedToast', String(failedCount)));
      lastNotifiedTaskStatus.current = activeTask.status;
    }
  }, [activeTask, completeCount, failedCount]);

  const buildJobPayload = (indices?: number[]): DownloadJobPayload => ({
    galleryFrontPageUrl: galleryFrontPageUrl.current,
    galleryName: galleryInfo?.name ?? '',
    galleryId: galleryInfo?.id ?? '',
    downloadPath: configLatest.current.intermediateDownloadPath,
    rangeStart: range[0],
    rangeEnd: range[1],
    imagesPerPage: galleryPageInfoRef.current.imagesPerPage,
    numPages: galleryPageInfoRef.current.numPages,
    totalImages: galleryPageInfoRef.current.totalImages,
    indices,
  });

  const launchDownload = async (mode: 'full' | 'resume' | 'retry', indices?: number[]) => {
    if (!galleryInfo) return false;
    lastNotifiedTaskStatus.current = null;
    setStatus(StatusEnum.Downloading);

    const payload = buildJobPayload(indices);
    const fn =
      mode === 'resume' ? resumeDownload : mode === 'retry' ? retryFailedDownload : startDownload;
    const response = await fn(payload);

    if (!response?.ok) {
      toast.error(t('failedStartDownload'));
      setStatus(StatusEnum.BeforeDownload);
      return false;
    }

    if (mode === 'full' && configLatest.current.saveGalleryInfo) {
      downloadAsTxtFile(formatGalleryInfoTxt(galleryInfo, galleryFrontPageUrl.current));
    }
    return true;
  };

  const handleConfirmDownload = async () => {
    try {
      await downloadHistoryStorage.add({
        url: galleryFrontPageUrl.current,
        name: galleryInfo!.name,
        range,
        info: galleryInfo!,
      });
    } catch (e) {
      console.error('add download history failed@', e);
      toast.error(t('failedSaveHistory'));
    }
    await launchDownload('full');
  };

  const handleResumeMissing = async () => {
    const record = galleryRecords[galleryFrontPageUrl.current];
    const missing = computeMissingIndices(record, range[0], range[1]);
    if (missing.length === 0) {
      toast.info(t('nothingToResume'));
      return;
    }
    await launchDownload('resume', missing);
  };

  const handleRetryFailed = async (indices?: number[]) => {
    const record = galleryRecords[galleryFrontPageUrl.current];
    const failed = indices ?? computeFailedIndices(record, progressRange.start, progressRange.end);
    if (failed.length === 0) {
      toast.info(t('noFailedItems'));
      return;
    }
    await launchDownload('retry', failed);
  };

  const reloadGallery = async () => {
    setStatus(StatusEnum.Loading);
    const url = await getCurrentTabUrl().catch(() => '');
    tabUrlRef.current = url;
    setCurrentPage(getCurrentPageFromUrl(url));
    const galleryHtmlStr = await getCurrentTabHtml().catch(() => '');
    if (!isGalleryPageHtml(galleryHtmlStr)) {
      setStatus(StatusEnum.Fail);
      return;
    }
    const pageInfo = extractGalleryPageInfo(galleryHtmlStr);
    setGalleryPageInfo(pageInfo);
    const galleryInfoResult = await extractGalleryInfo(galleryHtmlStr);
    setGalleryInfo(galleryInfoResult);
    configLatest.current = {
      ...configLatest.current,
      intermediateDownloadPath:
        (config || DEFAULT_CONFIG).intermediateDownloadPath +
        removeInvalidCharFromFilename(galleryInfoResult.name),
    };
    setStatus(StatusEnum.BeforeDownload);
  };

  const isDownloading =
    status === StatusEnum.Downloading ||
    activeTask?.status === 'running' ||
    activeTask?.status === 'dispatch_complete';

  const downloadsBadge = isDownloading && inProgressCount > 0 ? String(inProgressCount) : undefined;

  useMounted(() => {
    (async () => {
      const url = await getCurrentTabUrl().catch(() => '');
      tabUrlRef.current = url;
      setCurrentPage(getCurrentPageFromUrl(url));
      if (isEHentaiGalleryUrl(url)) {
        const items = configLatest.current ?? DEFAULT_CONFIG;
        configLatest.current = items;

        const trimmed = url.split('?')[0];
        galleryFrontPageUrl.current = trimmed.substring(0, trimmed.lastIndexOf('/') + 1);
        const galleryHtmlStr = await getCurrentTabHtml().catch(() => '');
        if (!isGalleryPageHtml(galleryHtmlStr)) {
          setStatus(StatusEnum.Fail);
          return;
        }

        const pageInfo = extractGalleryPageInfo(galleryHtmlStr);
        setGalleryPageInfo(pageInfo);
        const galleryInfoResult = await extractGalleryInfo(galleryHtmlStr);
        setGalleryInfo(galleryInfoResult);

        configLatest.current = {
          ...configLatest.current,
          intermediateDownloadPath:
            configLatest.current.intermediateDownloadPath +
            removeInvalidCharFromFilename(galleryInfoResult.name),
        };

        setStatus(StatusEnum.BeforeDownload);

        const task = await downloadTaskStorage.get();
        if (task?.galleryUrl === galleryFrontPageUrl.current) {
          const restored = taskStatusToUi(task.status);
          if (restored !== null) setStatus(restored);
        }
        return;
      }
      if (isEHentaiPageUrl(url)) {
        setStatus(StatusEnum.EHentaiOther);
        return;
      }
      setStatus(StatusEnum.OtherPage);
    })();
  });

  const handleClickDownload = () => {
    if (!galleryInfo) return;
    setConfirmOpen(true);
  };

  const openDownloadFolder = () => {
    chrome.downloads.showDefaultFolder();
  };

  const resetToBeforeDownload = () => {
    lastNotifiedTaskStatus.current = null;
    void downloadTaskStorage.set(null);
    setStatus(StatusEnum.BeforeDownload);
  };

  const isCenteredStatus = (CENTERED_STATUSES as readonly StatusEnum[]).includes(status);

  const progressPanel = (
    <div className="glass-panel flex flex-col gap-3 rounded-[20px] p-5">
      <DownloadProgress
        downloadCount={progressTotal}
        completeCount={completeCount}
        failedCount={failedCount}
        inProgressCount={inProgressCount}
      />
    </div>
  );

  const statusContent = (() => {
    switch (status) {
      case StatusEnum.Loading:
        return (
          <div className="flex h-popup-content flex-col items-center justify-center gap-3">
            <Spinner size="lg" color="primary" />
            <p className="animate-pulse text-[13px] font-medium text-muted">{t('initializing')}</p>
          </div>
        );
      case StatusEnum.EHentaiOther:
        return (
          <StatusCard
            variant="warning"
            icon={<InfoIcon />}
            title={t('notOnGalleryPage')}
            description={t('notOnGalleryDesc')}
          >
            <Button size="sm" variant="flat" onPress={() => void reloadGallery()}>
              {t('refreshPage')}
            </Button>
          </StatusCard>
        );
      case StatusEnum.OtherPage:
        return (
          <StatusCard variant="info" icon={<LinkIcon />} title={t('openGalleryFirst')}>
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-center gap-2 text-sm leading-relaxed text-body">
                <Link
                  href="https://e-hentai.org/"
                  isExternal
                  className="font-medium text-brand-accent underline underline-offset-2"
                >
                  E-Hentai
                </Link>
                <span className="text-[11px] text-muted-soft">·</span>
                <Link
                  href="https://exhentai.org/"
                  isExternal
                  className="font-medium text-brand-accent underline underline-offset-2"
                >
                  ExHentai
                </Link>
              </div>
              <Button size="sm" variant="flat" onPress={() => void reloadGallery()}>
                {t('refreshPage')}
              </Button>
            </div>
          </StatusCard>
        );
      case StatusEnum.Fail:
        return (
          <StatusCard
            variant="error"
            icon={<CloseIcon />}
            title={t('unableReadGallery')}
            description={t('unableReadGalleryDesc')}
          >
            <Button size="sm" color="primary" variant="flat" onPress={() => void reloadGallery()}>
              {t('refreshPage')}
            </Button>
          </StatusCard>
        );
      case StatusEnum.BeforeDownload: {
        const currentGalleryRecord = galleryRecords[galleryFrontPageUrl.current];
        const counts = currentGalleryRecord
          ? Object.values(currentGalleryRecord.images).reduce(
              (acc, img) => {
                acc[img.state] += 1;
                return acc;
              },
              { complete: 0, in_progress: 0, interrupted: 0 } as Record<
                'complete' | 'in_progress' | 'interrupted',
                number
              >
            )
          : null;
        const trackedTotal = counts ? counts.complete + counts.in_progress + counts.interrupted : 0;
        const missingCount = computeMissingIndices(currentGalleryRecord, range[0], range[1]).length;
        return (
          <div className="scrollbar-glass flex h-full w-full flex-col gap-3 overflow-y-auto px-4 py-4 pb-6">
            {/* Gallery Info Widget - Bento Style */}
            <div className="glass-panel group flex min-h-[100px] flex-col justify-end gap-2.5 rounded-[20px] p-4">
              <h2 className="line-clamp-2 text-[16px] font-bold leading-tight tracking-tight text-ink">
                {galleryInfo.name || ''}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full border border-[var(--eh-glass-border)] bg-[rgb(8_8_9/0.2)] px-2.5 py-1 text-[11px] font-medium text-muted backdrop-blur-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-accent/80" />
                  {galleryPageInfo.totalImages} {t('imagesLabel')}
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-[var(--eh-glass-border)] bg-[rgb(8_8_9/0.2)] px-2.5 py-1 text-[11px] font-medium text-muted backdrop-blur-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-accent/50" />
                  {galleryPageInfo.numPages} {t('pagesLabel')}
                </div>
              </div>
            </div>

            {counts && trackedTotal > 0 && (
              <div className="glass-panel flex flex-col gap-2 rounded-[16px] px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold tracking-tight text-ink">
                    {t('previouslyTracked')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setGalleryDetailOpen(true)}
                    className="rounded-full border border-brand-accent/30 bg-brand-accent/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-brand-accent hover:bg-brand-accent/[0.15]"
                  >
                    {t('viewDetails')}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span className="bg-success/15 rounded-full px-2 py-0.5 font-medium text-success">
                    {t('badgeComplete', String(counts.complete))}
                  </span>
                  <span className="bg-warning/15 rounded-full px-2 py-0.5 font-medium text-warning">
                    {t('badgeInProgress', String(counts.in_progress))}
                  </span>
                  <span className="bg-error/15 rounded-full px-2 py-0.5 font-medium text-error">
                    {t('badgeFailed', String(counts.interrupted))}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {missingCount > 0 && (
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      onPress={() => void handleResumeMissing()}
                    >
                      {t('continueMissing')} ({missingCount})
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      setRange([1, galleryPageInfo.totalImages]);
                      setConfirmOpen(true);
                    }}
                  >
                    {t('redownloadAll')}
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {/* Range Selector Widget */}
              {range[1] > 0 && (
                <div className="glass-panel col-span-3 flex flex-col gap-1.5 rounded-[16px] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold tracking-tight text-ink">
                      {t('downloadRange')}
                    </span>
                    <span className="flex h-5 items-center justify-center rounded-full border border-brand-accent/20 bg-brand-accent/[0.08] px-2 font-mono text-[11px] font-bold text-brand-accent">
                      {range[0]} - {range[1]}
                    </span>
                  </div>
                  <div className="px-1 pb-1">
                    <PageSelector
                      range={range}
                      setRange={setRange}
                      maxValue={galleryPageInfo.totalImages}
                      imagesPerPage={galleryPageInfo.imagesPerPage}
                      currentPage={currentPage}
                    />
                  </div>
                </div>
              )}

              {/* Selected Count Widget */}
              <div className="glass-panel col-span-1 flex flex-col items-center justify-center p-3 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-soft">
                  {t('selected')}
                </span>
                <span className="mt-0.5 font-mono text-2xl font-black tracking-tighter text-brand-accent">
                  {downloadCount}
                </span>
              </div>

              {/* Action Button Widget */}
              <Button
                type="button"
                variant="flat"
                className="group relative col-span-2 flex h-full min-h-[72px] flex-row items-center justify-center gap-3 overflow-hidden rounded-[16px] border border-brand-accent/25 bg-brand-accent/10 px-5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),var(--eh-shadow-card)] backdrop-blur-xl transition-[transform,background-color,box-shadow,border-color] duration-300 ease-out hover:border-brand-accent/35 hover:bg-brand-accent/15 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),var(--eh-glow)] active:scale-[0.98]"
                onPress={handleClickDownload}
                disableRipple
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] text-brand-accent backdrop-blur-md">
                  <DownloadIcon />
                </div>
                <span className="text-sm font-bold tracking-wide text-brand-accent">
                  {t('startDownload')}
                </span>
              </Button>
            </div>
          </div>
        );
      }
      case StatusEnum.Downloading:
        return (
          <div className="scrollbar-glass flex h-full w-full flex-col gap-3 overflow-y-auto px-4 py-4 pb-6">
            <div className="glass-panel glass-panel-live relative flex flex-col justify-end rounded-[20px] p-5">
              <div>
                <h3 className="line-clamp-2 text-[15px] font-bold leading-tight tracking-tight text-ink">
                  {galleryInfo?.name || ''}
                </h3>
                <div className="mt-2.5 flex items-center gap-2">
                  <Spinner size="sm" color="primary" />
                  <span className="text-[13px] font-medium text-brand-accent">
                    {t('downloadingImages')}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-muted-soft">{t('backgroundHint')}</p>
              </div>
            </div>
            {progressPanel}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="flat"
                onPress={() => {
                  setSelectedTab('downloadList');
                }}
              >
                {t('viewFileList')} →
              </Button>
              <Button
                size="sm"
                color="danger"
                variant="flat"
                onPress={() => {
                  void cancelDownload();
                  toast.info(t('downloadCancelled'));
                }}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        );
      case StatusEnum.DownloadSuccess:
        return (
          <div className="scrollbar-glass flex h-full w-full flex-col gap-3 overflow-y-auto px-4 py-4 pb-6">
            <div className="glass-panel flex flex-col gap-3 rounded-[20px] p-5">
              <div className="text-left">
                <h3 className="line-clamp-2 text-[15px] font-bold leading-tight tracking-tight text-ink">
                  {galleryInfo?.name || ''}
                </h3>
                <p className="mt-1.5 text-[12px] font-medium text-muted">
                  {t('allImagesSuccess', String(progressTotal))}
                </p>
              </div>
              <StatusCard
                embedded
                variant="success"
                icon={<CheckIcon />}
                title={t('downloadCompleted')}
                description={
                  <>
                    {t('enjoyingExtension')}{' '}
                    <Link
                      href="https://github.com/Oc1S/ehentai-helper"
                      isExternal
                      className="font-medium text-brand-accent underline underline-offset-2"
                    >
                      {t('starGithubLink')}
                    </Link>
                  </>
                }
              />
            </div>
            {progressPanel}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="flat" onPress={openDownloadFolder}>
                {t('openFolder')}
              </Button>
              <Button size="sm" variant="flat" onPress={resetToBeforeDownload}>
                {t('downloadAgain')}
              </Button>
            </div>
          </div>
        );
      case StatusEnum.DownloadPartialSuccess:
        return (
          <div className="scrollbar-glass flex h-full w-full flex-col gap-3 overflow-y-auto px-4 py-4 pb-6">
            <div className="glass-panel flex flex-col gap-3 rounded-[20px] p-5">
              <div className="text-left">
                <h3 className="line-clamp-2 text-[15px] font-bold leading-tight tracking-tight text-ink">
                  {galleryInfo?.name || ''}
                </h3>
                <p className="mt-1.5 text-[12px] font-medium text-muted">
                  {t('partialSuccessSummary', [String(completeCount), String(failedCount)])}
                </p>
              </div>
              <StatusCard
                embedded
                variant="warning"
                icon={<InfoIcon />}
                title={t('partiallyCompleted')}
                description={t('partialCompletedDesc')}
              />
              <Button size="sm" variant="flat" onPress={() => setGalleryDetailOpen(true)}>
                {t('viewDetails')}
              </Button>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={() => void handleRetryFailed()}
              >
                {t('retryFailed')}
              </Button>
              <Button size="sm" variant="flat" onPress={openDownloadFolder}>
                {t('openFolder')}
              </Button>
            </div>
            {progressPanel}
          </div>
        );
      case StatusEnum.DownloadFailed:
        return (
          <div className="scrollbar-glass flex h-full w-full flex-col gap-3 overflow-y-auto px-4 py-4 pb-6">
            <div className="glass-panel flex flex-col gap-3 rounded-[20px] p-5">
              <div className="text-left">
                <h3 className="line-clamp-2 text-[15px] font-bold leading-tight tracking-tight text-ink">
                  {galleryInfo?.name || ''}
                </h3>
                <p className="mt-1.5 text-[12px] font-medium text-muted">
                  {t('allImagesFailed', String(failedCount))}
                </p>
              </div>
              <StatusCard
                embedded
                variant="error"
                icon={<CloseIcon />}
                title={t('downloadFailedTitle')}
                description={t('downloadFailedDesc')}
              />
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={() => void handleRetryFailed()}
              >
                {t('retryFailed')}
              </Button>
              <Button size="sm" variant="flat" onPress={resetToBeforeDownload}>
                {t('downloadAgain')}
              </Button>
            </div>
            {progressPanel}
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <AppShell>
      <div className="popup-bg flex h-popup w-popup flex-col overflow-hidden">
        <header className="flex h-popup-header shrink-0 items-center justify-between px-5">
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            E-Hentai <span className="text-brand-accent">Helper</span>
          </span>
          <DownloadSettings
            disabled={isDownloading}
            pathPreview={
              galleryInfo
                ? `${(config || DEFAULT_CONFIG).intermediateDownloadPath}${removeInvalidCharFromFilename(galleryInfo.name)}`
                : undefined
            }
          />
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-[720px] flex-col">
            <Tabs
              aria-label="popup tabs"
              className="w-full"
              selectedKey={selectedTab}
              onSelectionChange={(key) => setSelectedTab(String(key))}
              classNames={{
                base: 'flex justify-center',
              }}
            >
              <Tab key="info" title={t('infoTab')}>
                <div
                  className={`scrollbar-glass h-popup-content w-full overflow-y-auto overflow-x-hidden ${isCenteredStatus ? 'flex items-center justify-center px-4 py-2' : ''}`}
                >
                  {statusContent}
                </div>
              </Tab>
              <Tab
                key="downloadList"
                title={
                  <span className="inline-flex items-center gap-1.5">
                    {t('downloadsTab')}
                    {downloadsBadge ? (
                      <span className="rounded-full bg-brand-accent px-1.5 py-0.5 text-[10px] font-bold text-black">
                        {downloadsBadge}
                      </span>
                    ) : null}
                  </span>
                }
              >
                <DownloadTable taskId={activeTask?.taskId} />
              </Tab>
              <Tab key="history" title={t('historyTab')}>
                <History />
              </Tab>
            </Tabs>
          </div>
        </div>
        <GalleryDetailModal
          isOpen={galleryDetailOpen}
          onClose={() => setGalleryDetailOpen(false)}
          record={galleryRecords[galleryFrontPageUrl.current] ?? null}
          onRetryIndex={(index) => void handleRetryFailed([index])}
          onRetryAllFailed={() => void handleRetryFailed()}
        />
        <DownloadConfirmModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => void handleConfirmDownload()}
          imageCount={downloadCount}
          range={range}
          downloadPath={configLatest.current.intermediateDownloadPath}
          intervalMs={configLatest.current.downloadInterval}
        />
      </div>
    </AppShell>
  );
};

export default Popup;
