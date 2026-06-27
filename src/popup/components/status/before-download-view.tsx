import { Download } from 'lucide-react';

import { EhButton } from '@/components/eh-button';
import { computeMissingIndices } from '@/download/helpers';
import type { GalleryInfo, GalleryRecord } from '@/storage';
import { t } from '@/utils/i18n';

import { RangeSelectorContent } from '../range-selector-panel';

export const BeforeDownloadView = ({
  galleryInfo,
  totalImages,
  numPages,
  range,
  setRange,
  galleryRecord,
  onStartDownload,
  onResumeMissing,
  onViewDetails,
}: {
  galleryInfo: GalleryInfo;
  totalImages: number;
  numPages: number;
  range: [number, number];
  setRange: (range: [number, number]) => void;
  galleryRecord: GalleryRecord | undefined;
  onStartDownload: () => void;
  onResumeMissing: () => void;
  onViewDetails: () => void;
}) => {
  const counts = galleryRecord
    ? Object.values(galleryRecord.images).reduce(
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
  const missingCount = computeMissingIndices(galleryRecord, range[0], range[1]).length;
  const downloadCount = range[1] - range[0] + 1;
  const rangeSelector = (
    <RangeSelectorContent range={range} setRange={setRange} maxValue={totalImages} />
  );

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
                  {totalImages} {t('imagesLabel')} · {numPages} {t('pagesLabel')}
                </p>
              </div>
            </div>
          </div>

          {rangeSelector ? (
            <>
              <div className="flex flex-col gap-2.5 border-t border-[var(--eh-hairline-soft)] px-4 py-3.5">
                {rangeSelector}
              </div>
              <div className="border-t border-[var(--eh-hairline-soft)] p-4 pt-3">
                <EhButton
                  appearance="primary"
                  ehSize="lg"
                  fullWidth
                  onPress={onStartDownload}
                  startContent={
                    <span className="eh-btn__icon">
                      <Download size={17} strokeWidth={1.75} />
                    </span>
                  }
                >
                  {t('startDownloadWithCount', String(downloadCount))}
                </EhButton>
              </div>
            </>
          ) : null}

          {counts && trackedTotal > 0 ? (
            <PreviouslyTrackedSection
              counts={counts}
              missingCount={missingCount}
              onResumeMissing={onResumeMissing}
              onViewDetails={onViewDetails}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

const PreviouslyTrackedSection = ({
  counts,
  missingCount,
  onResumeMissing,
  onViewDetails,
}: {
  counts: Record<'complete' | 'in_progress' | 'interrupted', number>;
  missingCount: number;
  onResumeMissing: () => void;
  onViewDetails: () => void;
}) => (
  <div className="border-t border-[var(--eh-hairline-soft)] px-4 py-3">
    <p className="text-xs font-medium uppercase tracking-wide text-muted-soft">
      {t('previouslyTracked')}
    </p>
    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-soft">
        <span className="text-success">{t('badgeComplete', String(counts.complete))}</span>
        <span aria-hidden>·</span>
        <span className="text-warning">{t('badgeInProgress', String(counts.in_progress))}</span>
        <span aria-hidden>·</span>
        <span className="text-error">{t('badgeFailed', String(counts.interrupted))}</span>
      </div>
      <EhButton appearance="secondary" ehSize="sm" onPress={onViewDetails}>
        {t('viewDetails')}
      </EhButton>
    </div>
    {missingCount > 0 ? (
      <div className="mt-2.5">
        <EhButton appearance="primary" ehSize="sm" onPress={onResumeMissing}>
          {t('continueMissing')} ({missingCount})
        </EhButton>
      </div>
    ) : null}
  </div>
);
