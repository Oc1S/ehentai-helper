import type { ReactNode } from 'react';
import { Download } from 'lucide-react';

import { EhButton } from '@/components/eh-button';
import { EhDownloadProgressPanel } from '@/components/eh-progress';
import { Spinner } from '@/components/ui-primitives';
import { t } from '@/utils/i18n';

import { DownloadResultSummary } from '../download-result-summary';

export const DownloadingView = ({
  galleryName,
  downloadCount,
  completeCount,
  failedCount,
  inProgressCount,
  onViewDetails,
  onCancel,
}: {
  galleryName: string;
  downloadCount: number;
  completeCount: number;
  failedCount: number;
  inProgressCount: number;
  onViewDetails: () => void;
  onCancel: () => void;
}) => (
  <div className="flex h-full min-h-0 w-full flex-col px-4 py-4">
    <div className="scrollbar-glass flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-3">
      <div className="glass-panel glass-panel-live rounded-eh-2xl relative flex shrink-0 flex-col justify-end p-5">
        <div>
          <h3 className="line-clamp-2 text-[15px] font-bold leading-tight tracking-tight text-ink">
            {galleryName}
          </h3>
          <div className="mt-2.5 flex items-center gap-2">
            <Spinner size="sm" />
            <span className="text-[13px] font-medium text-brand-accent">
              {t('downloadingImages')}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-soft">{t('backgroundHint')}</p>
        </div>
      </div>
      <div className="glass-panel rounded-eh-2xl flex flex-col gap-3 p-5">
        <EhDownloadProgressPanel
          downloadCount={downloadCount}
          completeCount={completeCount}
          failedCount={failedCount}
          inProgressCount={inProgressCount}
        />
      </div>
    </div>
    <div className="min-h-popup-footer flex shrink-0 flex-col justify-center border-t border-[var(--eh-hairline-soft)] pt-3">
      <div className="flex items-stretch gap-2">
        <EhButton variant="secondary" ehSize="md" onPress={onViewDetails}>
          {t('viewDetails')}
        </EhButton>
        <EhButton variant="danger" ehSize="md" className="min-w-0 flex-1" onPress={onCancel}>
          {t('cancel')}
        </EhButton>
      </div>
    </div>
  </div>
);

export const DownloadFailedView = ({
  galleryName,
  downloadCount,
  completeCount,
  failedCount,
  rangeStart,
  rangeEnd,
  footer,
}: {
  galleryName: string;
  downloadCount: number;
  completeCount: number;
  failedCount: number;
  rangeStart: number;
  rangeEnd: number;
  footer: ReactNode;
}) => (
  <div className="flex h-full min-h-0 w-full flex-col px-4 py-4">
    <div className="scrollbar-glass flex min-h-0 flex-1 flex-col overflow-y-auto pb-3">
      <DownloadResultSummary
        variant="failed"
        galleryName={galleryName}
        downloadCount={downloadCount}
        completeCount={completeCount}
        failedCount={failedCount}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
      />
    </div>
    <div className="min-h-popup-footer flex shrink-0 flex-col justify-center border-t border-[var(--eh-hairline-soft)] pt-3">
      {footer}
    </div>
  </div>
);

export const StartDownloadButton = ({
  downloadCount,
  onPress,
}: {
  downloadCount: number;
  onPress: () => void;
}) => (
  <EhButton
    variant="primary"
    ehSize="lg"
    fullWidth
    onPress={onPress}
    startContent={
      <span className="eh-btn__icon">
        <Download size={17} strokeWidth={1.75} />
      </span>
    }
  >
    {t('startDownloadWithCount', String(downloadCount))}
  </EhButton>
);
