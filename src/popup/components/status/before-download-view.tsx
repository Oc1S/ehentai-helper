import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

import { EhButton } from '@/components/eh-button';
import { computeMissingIndices } from '@/download/helpers';
import type { GalleryInfo, GalleryRecord } from '@/storage';
import { t } from '@/utils/i18n';

import { RangeSelectorContent } from '../range-selector-panel';

const countGalleryRecordStates = (record: GalleryRecord | undefined) => {
  if (!record) return { complete: 0, failed: 0 };
  let complete = 0;
  let failed = 0;
  for (const img of Object.values(record.images)) {
    if (img.state === 'complete') complete++;
    else if (img.state === 'interrupted') failed++;
  }
  return { complete, failed };
};

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
  const rangeTotal = range[1] - range[0] + 1;
  const { complete: completeCount, failed: failedCount } = countGalleryRecordStates(galleryRecord);
  const missingCount = computeMissingIndices(galleryRecord, range[0], range[1]).length;
  const hasHistory = Boolean(galleryRecord && Object.keys(galleryRecord.images).length > 0);
  const rangeSelector =
    range[1] > 0 ? (
      <RangeSelectorContent range={range} setRange={setRange} maxValue={totalImages} />
    ) : null;
  const galleryMeta = [
    galleryInfo.category,
    galleryInfo.uploader,
    totalImages > 0 ? t('galleryTotalShort', String(totalImages)) : null,
  ].filter(Boolean);

  return (
    <div className="flex h-full min-h-0 w-full flex-col px-4 py-2">
      <div className="scrollbar-glass flex min-h-0 flex-1 flex-col justify-center overflow-y-auto">
        <div className="glass-panel flex w-full shrink-0 flex-col overflow-hidden rounded-eh-2xl">
          <div className="grid shrink-0 grid-cols-[minmax(0,350px)_minmax(0,1fr)]">
            <section className="flex min-w-0 flex-col gap-3 p-4 pr-3">
              <div className="flex min-w-0 gap-3.5">
                <GalleryCover src={galleryInfo.coverUrl} name={galleryInfo.name} />
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

              <div className="mt-auto flex flex-wrap gap-1.5 text-xs text-muted-soft">
                {galleryMeta.map((item) => (
                  <span
                    key={item}
                    className="max-w-full truncate rounded-full border border-[var(--eh-hairline)] px-2 py-0.5 text-[11px] font-normal text-muted"
                  >
                    {item}
                  </span>
                ))}
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
                      <span className="flex shrink-0 items-center justify-center">
                        <Download size={17} strokeWidth={1.75} />
                      </span>
                    }
                  >
                    {t('startDownloadWithCount', String(rangeTotal))}
                  </EhButton>
                ) : null}
              </div>
            </aside>
          </div>

          {hasHistory ? (
            <HistorySection
              completeCount={completeCount}
              failedCount={failedCount}
              missingCount={missingCount}
              range={range}
              rangeTotal={rangeTotal}
              onResumeMissing={onResumeMissing}
              onViewDetails={onViewDetails}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

const coverFrameClass =
  'relative h-[184px] w-[128px] shrink-0 overflow-hidden rounded-eh-sm border border-[var(--eh-glass-border)] bg-surface-soft';

const GalleryCover = ({ src, name }: { src?: string; name: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={`${coverFrameClass} flex items-center justify-center text-3xl font-normal text-muted-soft`}
      >
        {(name || 'E').slice(0, 1)}
      </div>
    );
  }

  return (
    <div className={coverFrameClass}>
      {!isLoaded ? <div className="eh-cover-skeleton absolute inset-0" aria-hidden /> : null}
      <img
        src={src}
        alt={name ? `${name} cover` : ''}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        draggable={false}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
};

const HistoryPill = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'error';
}) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--eh-hairline-soft)] bg-[var(--eh-hover-bg)] px-2 py-0.5 text-[11px]">
    <span className="text-muted-soft">{label}</span>
    <span
      className={`font-semibold tabular-nums ${tone === 'success' ? 'text-success' : 'text-error'}`}
    >
      {value}
    </span>
  </span>
);

const HistorySection = ({
  completeCount,
  failedCount,
  missingCount,
  range,
  rangeTotal,
  onResumeMissing,
  onViewDetails,
}: {
  completeCount: number;
  failedCount: number;
  missingCount: number;
  range: [number, number];
  rangeTotal: number;
  onResumeMissing: () => void;
  onViewDetails: () => void;
}) => (
  <section className="shrink-0 border-t border-[var(--eh-hairline)] bg-[var(--eh-hover-bg)]/40 px-3 py-2.5">
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[10px] font-medium text-muted-soft">
        {t('previouslyTracked')}
      </span>
      <HistoryPill label={t('stateComplete')} value={completeCount} tone="success" />
      <HistoryPill label={t('stateFailed')} value={failedCount} tone="error" />
    </div>

    <div className="mt-2 flex items-center gap-2 rounded-eh-sm border border-[var(--eh-hairline)] bg-surface px-2.5 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <span className="shrink-0 text-[10px] font-medium text-muted">{t('thisDownloadRange')}</span>
        <span className="shrink-0 rounded-full border border-[var(--eh-hairline)] bg-[var(--eh-hover-bg)] px-1.5 py-px font-mono text-[10px] text-ink">
          {range[0]}-{range[1]}
        </span>
        <span className="text-[var(--eh-hairline)]">·</span>
        <span className="shrink-0 text-[10px] text-muted-soft">{t('stateMissing')}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums leading-none text-ink">
          {missingCount}
          <span className="text-xs font-normal text-muted-soft">/{rangeTotal}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
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
  </section>
);
