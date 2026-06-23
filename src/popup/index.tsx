import '../styles/index.css';
import '../styles/popup.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Link, Progress, Spinner } from '@nextui-org/react';
import { toast } from 'sonner';

import { AppShell } from '@/app';
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
    if (!activeTask || activeTask.galleryUrl !== galleryFrontPageUrl.current) {
      if (status === StatusEnum.Downloading && !activeTask) {
        setStatus(StatusEnum.BeforeDownload);
      }
      return;
    }
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
  }, [activeTask, completeCount, failedCount, status]);

  const buildJobPayload = (
    indices?: number[],
    rangeOverride?: [number, number]
  ): DownloadJobPayload => {
    const r = rangeOverride ?? range;
    return {
      galleryFrontPageUrl: galleryFrontPageUrl.current,
      galleryName: galleryInfo?.name ?? '',
      galleryId: galleryInfo?.id ?? '',
      downloadPath: configLatest.current.intermediateDownloadPath,
      rangeStart: r[0],
      rangeEnd: r[1],
      imagesPerPage: galleryPageInfoRef.current.imagesPerPage,
      numPages: galleryPageInfoRef.current.numPages,
      totalImages: galleryPageInfoRef.current.totalImages,
      indices,
    };
  };

  const launchDownload = async (
    mode: 'full' | 'resume' | 'retry',
    indices?: number[],
    rangeOverride?: [number, number]
  ) => {
    if (!galleryInfo) return false;
    lastNotifiedTaskStatus.current = null;
    setStatus(StatusEnum.Downloading);

    const payload = buildJobPayload(indices, rangeOverride);
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

  const initFromCurrentTab = async () => {
    setStatus(StatusEnum.Loading);
    const url = await getCurrentTabUrl().catch(() => '');
    tabUrlRef.current = url;
    setCurrentPage(getCurrentPageFromUrl(url));

    if (!isEHentaiGalleryUrl(url)) {
      setStatus(isEHentaiPageUrl(url) ? StatusEnum.EHentaiOther : StatusEnum.OtherPage);
      return;
    }

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

    const basePath = (config || DEFAULT_CONFIG).intermediateDownloadPath;
    configLatest.current = {
      ...configLatest.current,
      intermediateDownloadPath: basePath + removeInvalidCharFromFilename(galleryInfoResult.name),
    };

    setStatus(StatusEnum.BeforeDownload);

    const task = await downloadTaskStorage.get();
    if (task?.galleryUrl === galleryFrontPageUrl.current) {
      const restored = taskStatusToUi(task.status);
      if (restored !== null) setStatus(restored);
    }
  };

  const reloadGallery = () => {
    void initFromCurrentTab();
  };

  const isDownloading =
    status === StatusEnum.Downloading ||
    activeTask?.status === 'running' ||
    activeTask?.status === 'dispatch_complete';

  const downloadsBadge = isDownloading && inProgressCount > 0 ? String(inProgressCount) : undefined;

  useMounted(() => {
    void initFromCurrentTab();
  });

  const handleClickDownload = () => {
    void handleStartDownload();
  };

  const openDownloadFolder = () => {
    chrome.downloads.showDefaultFolder();
  };

  const resetToBeforeDownload = () => {
    lastNotifiedTaskStatus.current = null;
    void downloadTaskStorage.set(null);
    setStatus(StatusEnum.BeforeDownload);
  };

  const handleCancelDownload = async () => {
    await cancelDownload();
    resetToBeforeDownload();
    toast.info(t('downloadCancelled'), { position: 'bottom-right' });
  };

  const isCenteredStatus = (CENTERED_STATUSES as readonly StatusEnum[]).includes(status);
  const isSelfScrollingLayout = status === StatusEnum.BeforeDownload;

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
          <div className="flex h-full flex-col items-center justify-center gap-3">
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
          />
        );
      case StatusEnum.OtherPage:
        return (
          <StatusCard
            variant="info"
            icon={<LinkIcon />}
            title={t('openGalleryFirst')}
            description={t('openGalleryDesc')}
          >
            <div className="grid w-full max-w-[280px] grid-cols-2 gap-2">
              <Button
                as="a"
                href="https://e-hentai.org/"
                target="_blank"
                rel="noreferrer"
                size="sm"
                variant="flat"
                className="h-9 border border-[var(--eh-glass-border)] bg-[rgb(8_8_9/0.25)] font-medium text-brand-accent"
              >
                E-Hentai
              </Button>
              <Button
                as="a"
                href="https://exhentai.org/"
                target="_blank"
                rel="noreferrer"
                size="sm"
                variant="flat"
                className="h-9 border border-[var(--eh-glass-border)] bg-[rgb(8_8_9/0.25)] font-medium text-brand-accent"
              >
                ExHentai
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
          <div className="flex h-full min-h-0 w-full flex-col px-4 py-4">
            <div className="scrollbar-glass flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-3">
              <div className="glass-panel rounded-[20px] p-4">
                <div className="flex gap-3">
                  {galleryInfo.coverUrl ? (
                    <img
                      src={galleryInfo.coverUrl}
                      alt=""
                      className="h-[84px] w-[60px] shrink-0 rounded-lg border border-[var(--eh-glass-border)] bg-surface-soft object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 text-[15px] font-bold leading-snug tracking-tight text-ink">
                      {galleryInfo.name || ''}
                    </h2>
                    <p className="mt-1.5 text-[11px] font-medium text-muted">
                      {galleryPageInfo.totalImages} {t('imagesLabel')} · {galleryPageInfo.numPages}{' '}
                      {t('pagesLabel')}
                    </p>
                  </div>
                </div>
              </div>

              {counts && trackedTotal > 0 && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-[12px] border border-[var(--eh-glass-border)] bg-[rgb(8_8_9/0.22)] px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-ink">
                    {t('previouslyTracked')}
                  </span>
                  <span className="bg-success/15 rounded-full px-2 py-0.5 text-[10px] font-medium text-success">
                    {t('badgeComplete', String(counts.complete))}
                  </span>
                  <span className="bg-warning/15 rounded-full px-2 py-0.5 text-[10px] font-medium text-warning">
                    {t('badgeInProgress', String(counts.in_progress))}
                  </span>
                  <span className="bg-error/15 rounded-full px-2 py-0.5 text-[10px] font-medium text-error">
                    {t('badgeFailed', String(counts.interrupted))}
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    {missingCount > 0 && (
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        className="h-7 min-w-0 px-2 text-[11px]"
                        onPress={() => void handleResumeMissing()}
                      >
                        {t('continueMissing')} ({missingCount})
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => setGalleryDetailOpen(true)}
                      className="rounded-full border border-brand-accent/30 bg-brand-accent/[0.08] px-2 py-0.5 text-[10px] font-medium text-brand-accent hover:bg-brand-accent/[0.15]"
                    >
                      {t('viewDetails')}
                    </button>
                    <Button
                      size="sm"
                      variant="flat"
                      className="h-7 min-w-0 px-2 text-[11px]"
                      onPress={() => void handleStartDownload([1, galleryPageInfo.totalImages])}
                    >
                      {t('redownloadAll')}
                    </Button>
                  </div>
                </div>
              )}

              {range[1] > 0 && (
                <div className="glass-panel flex flex-col gap-2.5 rounded-[16px] px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold tracking-tight text-ink">
                      {t('downloadRange')}
                    </span>
                    <span className="flex h-5 shrink-0 items-center justify-center rounded-full border border-brand-accent/20 bg-brand-accent/[0.08] px-2 font-mono text-[11px] font-bold text-brand-accent">
                      {range[0]} - {range[1]}
                    </span>
                  </div>
                  <PageSelector
                    range={range}
                    setRange={setRange}
                    maxValue={galleryPageInfo.totalImages}
                    imagesPerPage={galleryPageInfo.imagesPerPage}
                    currentPage={currentPage}
                  />
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-[var(--eh-hairline-soft)] pt-3">
              <Button
                type="button"
                variant="flat"
                className="group relative flex h-12 w-full flex-row items-center justify-center gap-2.5 overflow-hidden rounded-[14px] border border-brand-accent/25 bg-brand-accent/10 px-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),var(--eh-shadow-card)] backdrop-blur-xl transition-[transform,background-color,box-shadow,border-color] duration-300 ease-out hover:border-brand-accent/35 hover:bg-brand-accent/15 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),var(--eh-glow)] active:scale-[0.98]"
                onPress={handleClickDownload}
                disableRipple
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.06] text-brand-accent backdrop-blur-md">
                  <DownloadIcon />
                </div>
                <span className="text-sm font-bold tracking-wide text-brand-accent">
                  {t('startDownloadWithCount', String(downloadCount))}
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
                onPress={() => void handleCancelDownload()}
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

  const popupTabs: { key: string; label: string; badge?: string }[] = [
    { key: 'info', label: t('galleryTab') },
    { key: 'downloadList', label: t('filesTab'), badge: downloadsBadge },
    { key: 'history', label: t('historyTab') },
  ];

  const tabContentClassName = `scrollbar-glass h-full min-h-0 w-full overflow-x-hidden ${
    isCenteredStatus
      ? 'flex flex-col items-center justify-center px-4 py-2 -translate-y-4'
      : isSelfScrollingLayout
        ? 'flex min-h-0 flex-col overflow-hidden'
        : 'overflow-y-auto'
  }`;

  return (
    <AppShell>
      <div className="popup-bg flex h-popup w-popup flex-col overflow-hidden">
        <header className="flex h-popup-header shrink-0 items-center gap-3 px-4">
          <span className="shrink-0 text-[15px] font-semibold tracking-tight text-ink">
            E-Hentai <span className="text-brand-accent">Helper</span>
          </span>
          <nav
            role="tablist"
            aria-label="popup tabs"
            className="flex min-w-0 flex-1 items-center justify-center"
          >
            <div className="flex items-center gap-0.5 rounded-full border border-[var(--eh-glass-border)] bg-[rgb(8_8_9/0.35)] p-0.5">
              {popupTabs.map((tab) => {
                const isActive = selectedTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelectedTab(tab.key)}
                    className={`flex h-7 items-center gap-1 rounded-full px-3 text-[12px] font-medium transition-colors ${
                      isActive
                        ? 'bg-surface-card text-ink shadow-card'
                        : 'text-muted hover:text-body'
                    }`}
                  >
                    {tab.label}
                    {tab.badge ? (
                      <span className="rounded-full bg-brand-accent px-1.5 py-0.5 text-[10px] font-bold text-black">
                        {tab.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </nav>
          <div className="shrink-0">
            <DownloadSettings
              disabled={isDownloading}
              pathPreview={
                galleryInfo
                  ? `${(config || DEFAULT_CONFIG).intermediateDownloadPath}${removeInvalidCharFromFilename(galleryInfo.name)}`
                  : undefined
              }
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-[720px] flex-col">
            {selectedTab === 'info' && <div className={tabContentClassName}>{statusContent}</div>}
            {selectedTab === 'downloadList' && <DownloadTable taskId={activeTask?.taskId} />}
            {selectedTab === 'history' && <History />}
          </div>
        </div>
        <GalleryDetailModal
          isOpen={galleryDetailOpen}
          onClose={() => setGalleryDetailOpen(false)}
          record={galleryRecords[galleryFrontPageUrl.current] ?? null}
          onRetryIndex={(index) => void handleRetryFailed([index])}
          onRetryAllFailed={() => void handleRetryFailed()}
        />
      </div>
    </AppShell>
  );
};

export default Popup;
