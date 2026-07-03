import { Download } from 'lucide-react';

import { EhButton } from '@/components/eh-button';
import { computeMissingIndices } from '@/download/helpers';
import type { GalleryInfo, GalleryRecord } from '@/storage';
import { t } from '@/utils/i18n';

import { RangeSelectorContent } from '../range-selector-panel';

export const BeforeDownloadView = ({
  galleryInfo,
  totalImages,
  range,
  setRange,
  galleryRecord,
  onStartDownload,
  onResumeMissing,
  onViewDetails,
}: {
  galleryInfo: GalleryInfo;
  totalImages: number;
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
  const galleryMeta = [galleryInfo.category, galleryInfo.uploader].filter(Boolean);

  return (
    <div className="flex h-full min-h-0 w-full flex-col px-4 py-3">
      <div className="scrollbar-glass flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto">
        <div className="glass-panel overflow-hidden rounded-eh-2xl">
          <div className="grid min-h-[250px] grid-cols-[minmax(0,350px)_minmax(0,1fr)]">
            <section className="flex min-w-0 flex-col justify-between gap-3 p-4 pr-3">
              <div className="flex min-w-0 gap-3.5">
                {galleryInfo.coverUrl ? (
                  <img
                    src={galleryInfo.coverUrl}
                    alt=""
                    className="h-[172px] w-[120px] shrink-0 rounded-eh-sm border border-[var(--eh-glass-border)] bg-surface-soft object-cover"
                  />
                ) : (
                  <div className="flex h-[172px] w-[120px] shrink-0 items-center justify-center rounded-eh-sm border border-[var(--eh-glass-border)] text-3xl font-normal text-muted-soft">
                    {(galleryInfo.name || 'E').slice(0, 1)}
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <h2 className="line-clamp-5 text-[16px] font-semibold leading-snug tracking-tight text-ink">
                    {galleryInfo.name || ''}
                  </h2>
                  {galleryInfo.nameInJapanese ? (
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted">
                      {galleryInfo.nameInJapanese}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1 text-xs text-muted-soft">
                {galleryMeta.slice(0, 2).map((item) => (
                  <span
                    key={item}
                    className="max-w-full truncate rounded-full border border-[var(--eh-hairline)] px-2 py-0.5 text-[11px] font-normal text-muted"
                  >
                    {item}
                  </span>
                ))}
                <span className="rounded-full bg-[var(--eh-hover-bg)] px-2 py-0.5 text-[11px] font-normal text-ink">
                  {totalImages} {t('imagesLabel')}
                </span>
              </div>
            </section>

            <aside className="flex min-w-0 flex-col border-l border-[var(--eh-hairline)] p-4">
              <div className="flex min-h-0 flex-1 flex-col justify-center">
                {rangeSelector ? (
                  <div className="flex flex-col gap-3 rounded-eh-sm border border-[var(--eh-hairline)] px-3 py-3">
                    {rangeSelector}
                  </div>
                ) : null}

                {rangeSelector ? (
                  <EhButton
                    variant="primary"
                    ehSize="lg"
                    fullWidth
                    className="mt-3"
                    onPress={onStartDownload}
                    startContent={
                      <span className="eh-btn__icon">
                        <Download size={17} strokeWidth={1.75} />
                      </span>
                    }
                  >
                    {t('startDownloadWithCount', String(downloadCount))}
                  </EhButton>
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
            </aside>
          </div>
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
  <div className="mt-3 border-t border-[var(--eh-hairline-soft)] pt-3">
    <p className="text-xs font-normal uppercase tracking-wide text-muted-soft">
      {t('previouslyTracked')}
    </p>
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-soft">
      <span className="text-success">{t('badgeComplete', String(counts.complete))}</span>
      <span aria-hidden>·</span>
      <span className="text-warning">{t('badgeInProgress', String(counts.in_progress))}</span>
      <span aria-hidden>·</span>
      <span className="text-error">{t('badgeFailed', String(counts.interrupted))}</span>
    </div>
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      <EhButton variant="secondary" ehSize="sm" onPress={onViewDetails}>
        {t('viewDetails')}
      </EhButton>
      {missingCount > 0 ? (
        <EhButton variant="primary" ehSize="sm" onPress={onResumeMissing}>
          {t('continueMissing', String(missingCount))}
        </EhButton>
      ) : null}
    </div>
  </div>
);
