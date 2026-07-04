import { useEffect, useState } from 'react';
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
  const galleryFacts =
    counts && trackedTotal > 0
      ? [
          {
            key: 'complete',
            label: t('stateComplete'),
            value: counts.complete,
            className: 'text-success',
          },
          {
            key: 'in_progress',
            label: t('stateInProgress'),
            value: counts.in_progress,
            className: 'text-warning',
          },
          {
            key: 'interrupted',
            label: t('stateFailed'),
            value: counts.interrupted,
            className: 'text-error',
          },
          {
            key: 'missing',
            label: t('stateMissing'),
            value: missingCount,
            className: 'text-muted',
          },
        ]
      : [];

  return (
    <div className="flex h-full min-h-0 w-full flex-col px-4 py-3">
      <div className="scrollbar-glass flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto">
        <div className="glass-panel overflow-hidden rounded-eh-2xl">
          <div className="grid min-h-[250px] grid-cols-[minmax(0,350px)_minmax(0,1fr)]">
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

              <div className="mt-auto flex flex-col gap-2.5">
                <div className="flex flex-wrap gap-1.5 text-xs text-muted-soft">
                  {galleryMeta.slice(0, 2).map((item) => (
                    <span
                      key={item}
                      className="max-w-full truncate rounded-full border border-[var(--eh-hairline)] px-2 py-0.5 text-[11px] font-normal text-muted"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                {galleryFacts.length > 0 ? <GalleryFactsGrid items={galleryFacts} /> : null}
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
                    trackedTotal={trackedTotal}
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
      {!isLoaded ? <div className="eh-cover-skeleton" aria-hidden /> : null}
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

const GalleryFactsGrid = ({
  items,
}: {
  items: Array<{
    key: string;
    label: string;
    value: number | string;
    helper?: string;
    className?: string;
  }>;
}) => (
  <div className="grid grid-cols-4 gap-1.5">
    {items.map((item) => (
      <div
        key={item.key}
        className="min-w-0 rounded-eh-sm border border-[var(--eh-hairline-soft)] bg-[var(--eh-hover-bg)] px-2 py-1.5"
      >
        <div className="flex min-w-0 items-baseline gap-1.5">
          <p
            className={`truncate text-[15px] font-semibold tabular-nums leading-none ${item.className ?? 'text-ink'}`}
          >
            {item.value}
          </p>
          {item.helper ? (
            <span className="shrink-0 text-[10px] font-normal leading-none text-muted-soft">
              {item.helper}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-[10px] font-normal leading-none text-muted-soft">
          {item.label}
        </p>
      </div>
    ))}
  </div>
);

const PreviouslyTrackedSection = ({
  trackedTotal,
  missingCount,
  onResumeMissing,
  onViewDetails,
}: {
  trackedTotal: number;
  missingCount: number;
  onResumeMissing: () => void;
  onViewDetails: () => void;
}) => {
  return (
    <section className="mt-3 rounded-eh-sm border border-[var(--eh-hairline)] bg-transparent p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-none text-ink">{t('previouslyTracked')}</p>
          <p className="mt-1 text-[11px] leading-none text-muted-soft">
            {trackedTotal} {t('imagesLabel')}
            {missingCount > 0 ? ` · ${missingCount} ${t('stateMissing')}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <EhButton variant="secondary" ehSize="sm" onPress={onViewDetails}>
          {t('viewDetails')}
        </EhButton>
        {missingCount > 0 ? (
          <EhButton variant="primary" ehSize="sm" onPress={onResumeMissing}>
            {t('continueMissing', String(missingCount))}
          </EhButton>
        ) : null}
      </div>
    </section>
  );
};
