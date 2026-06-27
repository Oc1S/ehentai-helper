import '../styles/index.css';
import '../styles/popup.css';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@nextui-org/react';
import { ChevronDown, Download, ExternalLink, Info, Link2, X } from 'lucide-react';
import { toast } from 'sonner';

import { AppShell } from '@/app';
import { EhButton } from '@/components/eh-button';
import { EhDownloadProgressPanel, EhDownloadResultProgress } from '@/components/eh-progress';
import { PageSelector } from '@/components/page-selector';
import { StatusCard } from '@/components/status-card';
import {
  cancelDownload,
  resumeDownload,
  retryFailedDownload,
  startDownload,
} from '@/download/client';
import { resolveGalleryDownloadPath } from '@/download/download-filename';
import { computeFailedIndices, computeMissingIndices } from '@/download/helpers';
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

import { History } from '../components/download-history';
import { DownloadSettings } from '../components/download-settings';
import { GalleryDetailModal } from '../components/gallery-detail-modal';
import { CENTERED_STATUSES, StatusEnum } from './status';

const ICON_STROKE = 1.5;

type ResultVariant = 'success' | 'partial' | 'failed';

const DownloadResultSummary = ({
  variant,
  galleryName,
  downloadCount,
  completeCount,
  failedCount,
  rangeStart,
  rangeEnd,
  children,
}: {
  variant: ResultVariant;
  galleryName: string;
  downloadCount: number;
  completeCount: number;
  failedCount: number;
  rangeStart: number;
  rangeEnd: number;
  children?: ReactNode;
}) => {
  const statusLabel =
    variant === 'success'
      ? t('downloadCompleted')
      : variant === 'partial'
        ? t('partiallyCompleted')
        : t('downloadFailedTitle');

  const statusClass =
    variant === 'success'
      ? 'text-brand-accent'
      : variant === 'partial'
        ? 'text-warning'
        : 'text-error';

  const desc =
    variant === 'success'
      ? t('allImagesSuccess', String(downloadCount))
      : variant === 'partial'
        ? t('partialSuccessSummary', [String(completeCount), String(failedCount)])
        : t('downloadFailedDesc');

  return (
    <div className="glass-panel rounded-eh-2xl flex shrink-0 flex-col gap-3 p-5">
      <div className="min-w-0 text-left">
        <h3 className="break-words text-[15px] font-bold leading-snug tracking-tight text-ink">
          {galleryName}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-soft">
          <span>{t('thisDownloadRange')}</span>
          <span className="rounded-full border border-brand-accent/20 bg-brand-accent/[0.08] px-2 py-0.5 font-mono text-xs font-bold text-brand-accent">
            {rangeStart} - {rangeEnd}
          </span>
          <span>
            · {downloadCount} {t('imagesLabel')}
          </span>
        </p>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wide ${statusClass}`}>
            {statusLabel}
          </p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${statusClass}`}>
            {completeCount}
            <span className="text-sm font-medium text-muted"> / {downloadCount}</span>
          </p>
        </div>
        {variant !== 'success' && failedCount > 0 ? (
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-soft">
              {t('stateFailed')}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-error">{failedCount}</p>
          </div>
        ) : null}
      </div>

      <EhDownloadResultProgress
        downloadCount={downloadCount}
        completeCount={completeCount}
        failedCount={failedCount}
      />

      <p className="text-xs leading-relaxed text-muted">{desc}</p>
      {children}
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
    case 'cancelled':
      return StatusEnum.BeforeDownload;
    default:
      return null;
  }
};

type PopupViewModelInput = {
  pageStatus: StatusEnum;
  optimisticTaskStatus: StatusEnum.Downloading | null;
  activeTask: ActiveDownloadTask | null;
  galleryUrl: string;
  range: [number, number];
  downloadCount: number;
};

const derivePopupViewModel = ({
  pageStatus,
  optimisticTaskStatus,
  activeTask,
  galleryUrl,
  range,
  downloadCount,
}: PopupViewModelInput) => {
  const currentTask = activeTask?.galleryUrl === galleryUrl ? activeTask : null;
  const taskStatus = currentTask ? taskStatusToUi(currentTask.status) : null;
  const status =
    pageStatus === StatusEnum.BeforeDownload
      ? taskStatus ?? optimisticTaskStatus ?? pageStatus
      : pageStatus;
  const isTerminalDownload =
    status === StatusEnum.DownloadSuccess ||
    status === StatusEnum.DownloadPartialSuccess ||
    status === StatusEnum.DownloadFailed;
  const isAnyTaskActive =
    activeTask?.status === 'running' || activeTask?.status === 'dispatch_complete';

  return {
    status,
    isTaskForCurrentGallery: Boolean(currentTask),
    isCenteredStatus: (CENTERED_STATUSES as readonly StatusEnum[]).includes(status),
    isTerminalDownload,
    isSelfScrollingLayout:
      status === StatusEnum.BeforeDownload ||
      status === StatusEnum.Downloading ||
      isTerminalDownload,
    isDownloading: status === StatusEnum.Downloading || isAnyTaskActive,
    progressRange: currentTask
      ? { start: currentTask.rangeStart, end: currentTask.rangeEnd }
      : { start: range[0], end: range[1] },
    progressTotal: currentTask ? currentTask.expectedCount : downloadCount,
    taskDisplayRange: currentTask
      ? ([currentTask.rangeStart, currentTask.rangeEnd] as [number, number])
      : range,
    taskDisplayTotal: currentTask ? currentTask.expectedCount : downloadCount,
  };
};

const Popup = () => {
  const [pageStatus, setPageStatus] = useState<StatusEnum>(StatusEnum.Loading);
  const [optimisticTaskStatus, setOptimisticTaskStatus] = useState<StatusEnum.Downloading | null>(
    null
  );
  const galleryRecords = useStorageSuspense(galleryRecordsStorage) || {};
  const activeTask = useStorage(downloadTaskStorage);
  const galleryFrontPageUrl = useRef('');
  const tabUrlRef = useRef('');
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
  const [terminalRangeExpanded, setTerminalRangeExpanded] = useState(false);

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
        galleryUrl: galleryFrontPageUrl.current,
        range,
        downloadCount,
      }),
    [activeTask, downloadCount, optimisticTaskStatus, pageStatus, range]
  );
  const {
    status,
    isTaskForCurrentGallery,
    isCenteredStatus,
    isTerminalDownload,
    isSelfScrollingLayout,
    isDownloading,
    progressRange,
    progressTotal,
    taskDisplayRange,
    taskDisplayTotal,
  } = viewModel;

  useEffect(() => {
    if (optimisticTaskStatus && isTaskForCurrentGallery) {
      setOptimisticTaskStatus(null);
    }
  }, [isTaskForCurrentGallery, optimisticTaskStatus]);

  useEffect(() => {
    if (!isTerminalDownload) {
      setTerminalRangeExpanded(false);
    }
  }, [isTerminalDownload]);

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

  const buildJobPayload = (
    indices?: number[],
    rangeOverride?: [number, number]
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
    };
  };

  const launchDownload = async (
    mode: 'full' | 'resume' | 'retry',
    indices?: number[],
    rangeOverride?: [number, number]
  ) => {
    if (!galleryInfo) return false;
    setOptimisticTaskStatus(StatusEnum.Downloading);

    const payload = buildJobPayload(indices, rangeOverride);
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
    setOptimisticTaskStatus(null);
    setPageStatus(StatusEnum.Loading);
    const url = await getCurrentTabUrl().catch(() => '');
    tabUrlRef.current = url;
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

  const reloadGallery = () => {
    void initFromCurrentTab();
  };

  useMounted(() => {
    void initFromCurrentTab();
  });

  const handleClickDownload = () => {
    void handleStartDownload();
  };

  const openDownloadFolder = () => {
    chrome.downloads.showDefaultFolder();
  };

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

  const progressPanel = (
    <div className="glass-panel rounded-eh-2xl flex flex-col gap-3 p-5">
      <EhDownloadProgressPanel
        downloadCount={progressTotal}
        completeCount={completeCount}
        failedCount={failedCount}
        inProgressCount={inProgressCount}
      />
    </div>
  );

  const rangeSelectorContent =
    range[1] > 0 ? (
      <>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold tracking-tight text-ink">
            {t('downloadRange')}
          </span>
          <span className="flex h-6 shrink-0 items-center justify-center rounded-full border border-brand-accent/20 bg-brand-accent/[0.08] px-2 font-mono text-xs font-bold text-brand-accent">
            {range[0]} - {range[1]}
          </span>
        </div>
        <PageSelector range={range} setRange={setRange} maxValue={galleryPageInfo.totalImages} />
      </>
    ) : null;

  const rangeSelectorPanel = rangeSelectorContent ? (
    <div className="glass-panel rounded-eh-xl flex flex-col gap-2.5 px-4 py-3.5">
      {rangeSelectorContent}
    </div>
  ) : null;

  const startDownloadButton = (
    <EhButton
      appearance="primary"
      ehSize="lg"
      fullWidth
      onPress={handleClickDownload}
      startContent={
        <span className="eh-btn__icon">
          <Download size={17} strokeWidth={1.75} />
        </span>
      }
    >
      {t('startDownloadWithCount', String(downloadCount))}
    </EhButton>
  );

  const rangeToggleButton = (expanded: boolean) => (
    <EhButton
      appearance="ghost"
      ehSize="sm"
      fullWidth
      onPress={() => setTerminalRangeExpanded((prev) => !prev)}
      endContent={
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      }
    >
      {expanded ? t('collapseRange') : t('adjustRangeAndDownload')}
    </EhButton>
  );

  const postDownloadShell = ({
    variant,
    footerActions,
    primaryAction,
    hideRangeControls = false,
  }: {
    variant: ResultVariant;
    footerActions?: ReactNode;
    primaryAction?: ReactNode;
    hideRangeControls?: boolean;
  }) => {
    const rangeExpanded = !hideRangeControls && terminalRangeExpanded;

    return (
      <div className="flex h-full min-h-0 w-full flex-col px-4 py-4">
        <div className="scrollbar-glass flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-3">
          <DownloadResultSummary
            variant={variant}
            galleryName={galleryInfo?.name || ''}
            downloadCount={taskDisplayTotal}
            completeCount={completeCount}
            failedCount={failedCount}
            rangeStart={taskDisplayRange[0]}
            rangeEnd={taskDisplayRange[1]}
          >
            {variant === 'success' ? (
              <a
                href="https://github.com/Oc1S/ehentai-helper"
                target="_blank"
                rel="noreferrer"
                className="eh-github-star-link group"
              >
                <span className="eh-github-star-link__text">
                  {t('enjoyingExtension')}
                  {t('starGithubLink')}
                </span>
                <ExternalLink className="eh-github-star-link__icon size-4 shrink-0" aria-hidden />
              </a>
            ) : null}
          </DownloadResultSummary>

          {!hideRangeControls ? rangeToggleButton(rangeExpanded) : null}
          {rangeExpanded ? rangeSelectorPanel : null}
        </div>
        <div className="min-h-popup-footer flex shrink-0 flex-col justify-center gap-2 border-t border-[var(--eh-hairline-soft)] pt-3">
          {footerActions}
          {!hideRangeControls && rangeExpanded && primaryAction ? primaryAction : null}
        </div>
      </div>
    );
  };

  const retryPrimaryButton = (count: number, onPress: () => void) => (
    <EhButton appearance="primary" ehSize="md" fullWidth onPress={onPress}>
      {t('retryAllFailed', String(count))}
    </EhButton>
  );

  const postDownloadActionRow = (leading: ReactNode, retryCount: number, onRetry: () => void) => (
    <div className="flex items-stretch gap-2">
      {leading}
      <div className="min-w-0 flex-1">{retryPrimaryButton(retryCount, onRetry)}</div>
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
            icon={<Info size={24} strokeWidth={ICON_STROKE} />}
            title={t('notOnGalleryPage')}
            description={t('notOnGalleryDesc')}
          />
        );
      case StatusEnum.OtherPage:
        return (
          <StatusCard
            variant="info"
            icon={<Link2 size={24} strokeWidth={ICON_STROKE} />}
            title={t('openGalleryFirst')}
            description={t('openGalleryDesc')}
          >
            <div className="grid w-full max-w-[280px] grid-cols-2 gap-2">
              <EhButton
                as="a"
                href="https://e-hentai.org/"
                target="_blank"
                rel="noreferrer"
                appearance="accent"
                ehSize="sm"
                className="w-full"
              >
                E-Hentai
              </EhButton>
              <EhButton
                as="a"
                href="https://exhentai.org/"
                target="_blank"
                rel="noreferrer"
                appearance="accent"
                ehSize="sm"
                className="w-full"
              >
                ExHentai
              </EhButton>
            </div>
          </StatusCard>
        );
      case StatusEnum.Fail:
        return (
          <StatusCard
            variant="error"
            icon={<X size={24} strokeWidth={ICON_STROKE} />}
            title={t('unableReadGallery')}
            description={t('unableReadGalleryDesc')}
          >
            <EhButton appearance="primary" ehSize="sm" onPress={() => void reloadGallery()}>
              {t('refreshPage')}
            </EhButton>
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
          <div className="flex h-full min-h-0 w-full flex-col px-4 py-3">
            <div className="scrollbar-glass flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto">
              <div className="glass-panel rounded-eh-2xl overflow-hidden">
                <div className="p-4">
                  <div className="flex gap-3">
                    {galleryInfo.coverUrl ? (
                      <img
                        src={galleryInfo.coverUrl}
                        alt=""
                        className="h-[84px] w-[60px] shrink-0 rounded-lg border border-[var(--eh-glass-border)] bg-surface-soft object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-3 text-[15px] font-bold leading-snug tracking-tight text-ink">
                        {galleryInfo.name || ''}
                      </h2>
                      <p className="mt-1.5 text-xs font-medium text-muted">
                        {galleryPageInfo.totalImages} {t('imagesLabel')} ·{' '}
                        {galleryPageInfo.numPages} {t('pagesLabel')}
                      </p>
                    </div>
                  </div>
                </div>

                {rangeSelectorContent ? (
                  <>
                    <div className="flex flex-col gap-2.5 border-t border-[var(--eh-hairline-soft)] px-4 py-3.5">
                      {rangeSelectorContent}
                    </div>
                    <div className="border-t border-[var(--eh-hairline-soft)] p-4 pt-3">
                      {startDownloadButton}
                    </div>
                  </>
                ) : null}

                {counts && trackedTotal > 0 ? (
                  <div className="border-t border-[var(--eh-hairline-soft)] px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-soft">
                      {t('previouslyTracked')}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-soft">
                        <span className="text-success">
                          {t('badgeComplete', String(counts.complete))}
                        </span>
                        <span aria-hidden>·</span>
                        <span className="text-warning">
                          {t('badgeInProgress', String(counts.in_progress))}
                        </span>
                        <span aria-hidden>·</span>
                        <span className="text-error">
                          {t('badgeFailed', String(counts.interrupted))}
                        </span>
                      </div>
                      <EhButton
                        appearance="secondary"
                        ehSize="sm"
                        onPress={() => setGalleryDetailOpen(true)}
                      >
                        {t('viewDetails')}
                      </EhButton>
                    </div>
                    {missingCount > 0 ? (
                      <div className="mt-2.5">
                        <EhButton
                          appearance="accent"
                          ehSize="sm"
                          onPress={() => void handleResumeMissing()}
                        >
                          {t('continueMissing')} ({missingCount})
                        </EhButton>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      }
      case StatusEnum.Downloading:
        return (
          <div className="flex h-full min-h-0 w-full flex-col px-4 py-4">
            <div className="scrollbar-glass flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-3">
              <div className="glass-panel glass-panel-live rounded-eh-2xl relative flex shrink-0 flex-col justify-end p-5">
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
                  <p className="mt-2 text-xs text-muted-soft">{t('backgroundHint')}</p>
                </div>
              </div>
              {progressPanel}
            </div>
            <div className="min-h-popup-footer flex shrink-0 flex-col justify-center border-t border-[var(--eh-hairline-soft)] pt-3">
              <div className="flex items-stretch gap-2">
                <EhButton
                  appearance="secondary"
                  ehSize="md"
                  onPress={() => setGalleryDetailOpen(true)}
                >
                  {t('viewDetails')}
                </EhButton>
                <EhButton
                  appearance="danger"
                  ehSize="md"
                  className="min-w-0 flex-1"
                  onPress={() => void handleCancelDownload()}
                >
                  {t('cancel')}
                </EhButton>
              </div>
            </div>
          </div>
        );
      case StatusEnum.DownloadSuccess:
        return postDownloadShell({
          variant: 'success',
          hideRangeControls: true,
          footerActions: (
            <div className="flex items-stretch gap-2">
              <EhButton
                appearance="primary"
                ehSize="md"
                className="min-w-0 flex-1"
                onPress={openDownloadFolder}
              >
                {t('openFolder')}
              </EhButton>
              <EhButton appearance="secondary" ehSize="md" onPress={resetToBeforeDownload}>
                {t('backToInitial')}
              </EhButton>
            </div>
          ),
        });
      case StatusEnum.DownloadPartialSuccess:
        return postDownloadShell({
          variant: 'partial',
          primaryAction: startDownloadButton,
          footerActions: postDownloadActionRow(
            <>
              <EhButton
                appearance="secondary"
                ehSize="md"
                onPress={() => setGalleryDetailOpen(true)}
              >
                {t('viewDetails')}
              </EhButton>
              <EhButton appearance="secondary" ehSize="md" onPress={openDownloadFolder}>
                {t('openFolder')}
              </EhButton>
            </>,
            failedCount,
            () => void handleRetryFailed()
          ),
        });
      case StatusEnum.DownloadFailed:
        return (
          <div className="flex h-full min-h-0 w-full flex-col px-4 py-4">
            <div className="scrollbar-glass flex min-h-0 flex-1 flex-col overflow-y-auto pb-3">
              <DownloadResultSummary
                variant="failed"
                galleryName={galleryInfo?.name || ''}
                downloadCount={taskDisplayTotal}
                completeCount={completeCount}
                failedCount={failedCount}
                rangeStart={taskDisplayRange[0]}
                rangeEnd={taskDisplayRange[1]}
              />
            </div>
            <div className="min-h-popup-footer flex shrink-0 flex-col justify-center border-t border-[var(--eh-hairline-soft)] pt-3">
              {postDownloadActionRow(
                <EhButton appearance="ghost" ehSize="md" onPress={resetToBeforeDownload}>
                  {t('backToInitial')}
                </EhButton>,
                failedCount,
                () => void handleRetryFailed()
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  })();

  const popupTabs: { key: string; label: string }[] = [
    { key: 'info', label: t('galleryTab') },
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
        <header className="grid h-popup-header shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4">
          <span className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-ink">
            E-Hentai <span className="text-brand-accent">Helper</span>
          </span>
          <nav role="tablist" aria-label="popup tabs" className="z-10 justify-self-center">
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
                    className={`flex h-8 items-center gap-1 rounded-full px-3 text-xs font-normal transition-colors ${
                      isActive
                        ? 'bg-surface-card text-ink shadow-card'
                        : 'text-muted hover:text-body'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </nav>
          <div className="min-w-0 justify-self-end">
            <DownloadSettings
              disabled={isDownloading}
              pathPreview={
                galleryInfo
                  ? resolveGalleryDownloadPath(
                      (config || DEFAULT_CONFIG).intermediateDownloadPath,
                      galleryInfo.name
                    )
                  : undefined
              }
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-[720px] flex-col">
            {selectedTab === 'info' && <div className={tabContentClassName}>{statusContent}</div>}
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
