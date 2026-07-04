import '../styles/index.css';
import '../styles/popup.css';

import { AppShell } from '@/app';
import { History } from '@/components/download-history';
import { GalleryDetailModal } from '@/components/gallery-detail-modal';

import { PopupHeader } from './components/popup-header';
import { PopupStatusContent } from './components/popup-status-content';
import { usePopupController } from './use-popup-controller';

const Popup = () => {
  const ctrl = usePopupController();

  return (
    <AppShell>
      <div className="popup-bg flex h-popup w-popup flex-col overflow-hidden">
        <PopupHeader
          selectedTab={ctrl.selectedTab}
          onSelectTab={ctrl.setSelectedTab}
          isDownloading={ctrl.isDownloading}
          pathPreview={ctrl.pathPreview}
        />

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-[720px] flex-col">
            {ctrl.selectedTab === 'info' && (
              <div className={ctrl.tabContentClassName}>
                <PopupStatusContent ctrl={ctrl} />
              </div>
            )}
            {ctrl.selectedTab === 'history' && <History />}
          </div>
        </div>

        <GalleryDetailModal
          isOpen={ctrl.galleryDetailOpen}
          onClose={() => ctrl.setGalleryDetailOpen(false)}
          record={ctrl.galleryRecords[ctrl.getGalleryUrl()] ?? null}
          taskId={ctrl.currentTask?.taskId}
          indices={ctrl.currentTask?.targetIndices}
          totalCount={ctrl.currentTask?.expectedCount}
          onRetryIndex={(index) => ctrl.handleRetryFailed([index])}
          onRetryAllFailed={() => ctrl.handleRetryFailed()}
        />
      </div>
    </AppShell>
  );
};

export default Popup;
