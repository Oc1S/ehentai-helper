import type { ReactNode } from 'react';
import { Download } from 'lucide-react';

import { EhButton } from '@/components/eh-button';
import { t } from '@/utils/i18n';

import { DownloadResultSummary } from '../download-result-summary';

export const DownloadingView = ({
  galleryName,
  downloadCount,
  completeCount,
  failedCount,
  inProgressCount,
  rangeStart,
  rangeEnd,
  rangeLabel,
  retryUnfinishedCount,
  onViewDetails,
  onRetryUnfinished,
  onCancel,
}: {
  galleryName: string;
  downloadCount: number;
  completeCount: number;
  failedCount: number;
  inProgressCount: number;
  rangeStart: number;
  rangeEnd: number;
  rangeLabel?: string;
  retryUnfinishedCount: number;
  onViewDetails: () => void;
  onRetryUnfinished: () => void;
  onCancel: () => void;
}) => (
  <div className="flex h-full min-h-0 w-full flex-col px-4 py-4">
    <div className="scrollbar-glass flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-3">
      <DownloadResultSummary
        variant="running"
        galleryName={galleryName}
        downloadCount={downloadCount}
        completeCount={completeCount}
        failedCount={failedCount}
        inProgressCount={inProgressCount}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        rangeLabel={rangeLabel}
      />
    </div>
    <div className="min-h-popup-footer flex shrink-0 flex-col justify-center border-t border-[var(--eh-hairline-soft)] pt-3">
      <div className="flex items-stretch gap-2">
        <EhButton variant="secondary" ehSize="md" onPress={onViewDetails}>
          {t('viewDetails')}
        </EhButton>
        {retryUnfinishedCount > 0 ? (
          <EhButton variant="secondary" ehSize="md" onPress={onRetryUnfinished}>
            {t('retryUnfinished', String(retryUnfinishedCount))}
          </EhButton>
        ) : null}
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
  rangeLabel,
  footer,
}: {
  galleryName: string;
  downloadCount: number;
  completeCount: number;
  failedCount: number;
  rangeStart: number;
  rangeEnd: number;
  rangeLabel?: string;
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
        rangeLabel={rangeLabel}
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
      <span className="flex shrink-0 items-center justify-center">
        <Download size={17} strokeWidth={1.75} />
      </span>
    }
  >
    {t('startDownloadWithCount', String(downloadCount))}
  </EhButton>
);
