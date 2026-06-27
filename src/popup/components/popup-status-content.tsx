import { EhButton } from '@/components/eh-button';
import { t } from '@/utils/i18n';

import { StatusEnum } from '../status';
import type { PopupController } from '../use-popup-controller';
import { PostDownloadActionRow, PostDownloadShell } from './post-download-shell';
import { BeforeDownloadView } from './status/before-download-view';
import {
  DownloadFailedView,
  DownloadingView,
  StartDownloadButton,
} from './status/downloading-view';
import {
  EHentaiOtherStatusView,
  FailStatusView,
  LoadingStatusView,
  OtherPageStatusView,
} from './status/placeholder-views';

export const PopupStatusContent = ({ ctrl }: { ctrl: PopupController }) => {
  const {
    status,
    galleryInfo,
    galleryPageInfo,
    galleryRecords,
    range,
    setRange,
    downloadCount,
    terminalRangeExpanded,
    setTerminalRangeExpanded,
    completeCount,
    failedCount,
    inProgressCount,
    progressTotal,
    taskDisplayRange,
    taskDisplayTotal,
    getGalleryUrl,
    reloadGallery,
    handleStartDownload,
    handleResumeMissing,
    handleRetryFailed,
    handleCancelDownload,
    resetToBeforeDownload,
    openDownloadFolder,
    setGalleryDetailOpen,
  } = ctrl;

  switch (status) {
    case StatusEnum.Loading:
      return <LoadingStatusView />;
    case StatusEnum.EHentaiOther:
      return <EHentaiOtherStatusView />;
    case StatusEnum.OtherPage:
      return <OtherPageStatusView />;
    case StatusEnum.Fail:
      return <FailStatusView onReload={reloadGallery} />;
    case StatusEnum.BeforeDownload:
      if (!galleryInfo) return null;
      return (
        <BeforeDownloadView
          galleryInfo={galleryInfo}
          totalImages={galleryPageInfo.totalImages}
          numPages={galleryPageInfo.numPages}
          range={range}
          setRange={setRange}
          galleryRecord={galleryRecords[getGalleryUrl()]}
          onStartDownload={handleStartDownload}
          onResumeMissing={handleResumeMissing}
          onViewDetails={() => setGalleryDetailOpen(true)}
        />
      );
    case StatusEnum.Downloading:
      return (
        <DownloadingView
          galleryName={galleryInfo?.name || ''}
          downloadCount={progressTotal}
          completeCount={completeCount}
          failedCount={failedCount}
          inProgressCount={inProgressCount}
          onViewDetails={() => setGalleryDetailOpen(true)}
          onCancel={handleCancelDownload}
        />
      );
    case StatusEnum.DownloadSuccess:
      return (
        <PostDownloadShell
          variant="success"
          galleryName={galleryInfo?.name || ''}
          downloadCount={taskDisplayTotal}
          completeCount={completeCount}
          failedCount={failedCount}
          rangeStart={taskDisplayRange[0]}
          rangeEnd={taskDisplayRange[1]}
          range={range}
          setRange={setRange}
          totalImages={galleryPageInfo.totalImages}
          terminalRangeExpanded={terminalRangeExpanded}
          onToggleRange={() => setTerminalRangeExpanded((prev) => !prev)}
          hideRangeControls
          footerActions={
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
          }
        />
      );
    case StatusEnum.DownloadPartialSuccess:
      return (
        <PostDownloadShell
          variant="partial"
          galleryName={galleryInfo?.name || ''}
          downloadCount={taskDisplayTotal}
          completeCount={completeCount}
          failedCount={failedCount}
          rangeStart={taskDisplayRange[0]}
          rangeEnd={taskDisplayRange[1]}
          range={range}
          setRange={setRange}
          totalImages={galleryPageInfo.totalImages}
          terminalRangeExpanded={terminalRangeExpanded}
          onToggleRange={() => setTerminalRangeExpanded((prev) => !prev)}
          primaryAction={
            <StartDownloadButton downloadCount={downloadCount} onPress={handleStartDownload} />
          }
          footerActions={
            <PostDownloadActionRow
              leading={
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
                </>
              }
              retryCount={failedCount}
              onRetry={() => handleRetryFailed()}
            />
          }
        />
      );
    case StatusEnum.DownloadFailed:
      return (
        <DownloadFailedView
          galleryName={galleryInfo?.name || ''}
          downloadCount={taskDisplayTotal}
          completeCount={completeCount}
          failedCount={failedCount}
          rangeStart={taskDisplayRange[0]}
          rangeEnd={taskDisplayRange[1]}
          footer={
            <PostDownloadActionRow
              leading={
                <EhButton appearance="secondary" ehSize="md" onPress={resetToBeforeDownload}>
                  {t('backToInitial')}
                </EhButton>
              }
              retryCount={failedCount}
              onRetry={() => handleRetryFailed()}
            />
          }
        />
      );
    default:
      return null;
  }
};
