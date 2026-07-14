import { AnimatePresence, motion } from 'framer-motion';

import { EhButton } from '@/components/eh-button';
import { t } from '@/utils/i18n';
import { viewEnter } from '@/utils/motion';

import { StatusEnum } from '../status';
import type { PopupController } from '../use-popup-controller';
import { PostDownloadActionRow, PostDownloadShell } from './post-download-shell';
import { BeforeDownloadView } from './status/before-download-view';
import { DownloadFailedView, DownloadingView } from './status/downloading-view';
import {
  EHentaiOtherStatusView,
  FailStatusView,
  OtherPageStatusView,
} from './status/placeholder-views';

const renderStatus = (ctrl: PopupController) => {
  const {
    status,
    galleryInfo,
    galleryPageInfo,
    galleryRecords,
    range,
    setRange,
    completeCount,
    failedCount,
    inProgressCount,
    progressTotal,
    taskDisplayRange,
    taskDisplayTotal,
    taskDisplayRangeLabel,
    getGalleryUrl,
    reloadGallery,
    handleStartDownload,
    handleResumeMissing,
    handleRetryFailed,
    handleRetryUnfinished,
    handleCancelDownload,
    resetToBeforeDownload,
    openDownloadFolder,
    setGalleryDetailOpen,
  } = ctrl;

  switch (status) {
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
          rangeStart={taskDisplayRange[0]}
          rangeEnd={taskDisplayRange[1]}
          rangeLabel={taskDisplayRangeLabel}
          retryUnfinishedCount={failedCount}
          onViewDetails={() => setGalleryDetailOpen(true)}
          onRetryUnfinished={handleRetryUnfinished}
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
          rangeLabel={taskDisplayRangeLabel}
          footerActions={
            <div className="flex items-stretch gap-2">
              <EhButton variant="secondary" ehSize="md" onPress={() => setGalleryDetailOpen(true)}>
                {t('viewDetails')}
              </EhButton>
              <EhButton variant="secondary" ehSize="md" onPress={openDownloadFolder}>
                {t('openFolder')}
              </EhButton>
              <EhButton
                variant="primary"
                ehSize="md"
                className="min-w-0 flex-1"
                onPress={resetToBeforeDownload}
              >
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
          rangeLabel={taskDisplayRangeLabel}
          footerActions={
            <PostDownloadActionRow
              leading={
                <>
                  <EhButton
                    variant="secondary"
                    ehSize="md"
                    onPress={() => setGalleryDetailOpen(true)}
                  >
                    {t('viewDetails')}
                  </EhButton>
                  <EhButton variant="secondary" ehSize="md" onPress={openDownloadFolder}>
                    {t('openFolder')}
                  </EhButton>
                  <EhButton variant="secondary" ehSize="md" onPress={resetToBeforeDownload}>
                    {t('backToInitial')}
                  </EhButton>
                </>
              }
              retryCount={failedCount}
              onRetry={() => handleRetryFailed(undefined, { closeDetail: false })}
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
          rangeLabel={taskDisplayRangeLabel}
          footer={
            <PostDownloadActionRow
              leading={
                <>
                  <EhButton
                    variant="secondary"
                    ehSize="md"
                    onPress={() => setGalleryDetailOpen(true)}
                  >
                    {t('viewDetails')}
                  </EhButton>
                  <EhButton variant="secondary" ehSize="md" onPress={resetToBeforeDownload}>
                    {t('backToInitial')}
                  </EhButton>
                </>
              }
              retryCount={failedCount}
              onRetry={() => handleRetryFailed(undefined, { closeDetail: false })}
            />
          }
        />
      );
    default:
      return null;
  }
};

export const PopupStatusContent = ({ ctrl }: { ctrl: PopupController }) => {
  if (ctrl.status === StatusEnum.Loading) return null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={ctrl.status}
        className="h-full min-h-0 w-full"
        initial={viewEnter.initial}
        animate={viewEnter.animate}
        exit={viewEnter.exit}
        transition={viewEnter.transition}
      >
        {renderStatus(ctrl)}
      </motion.div>
    </AnimatePresence>
  );
};
