import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, ImageOff } from 'lucide-react';

import { EhButton } from '@/components/eh-button';
import type { GalleryInfo, GalleryRecord } from '@/storage';
import { t } from '@/utils/i18n';
import { staggerContainer, staggerItem } from '@/utils/motion';

import { countRangeProgress } from '../../lib/progress';
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
  const rangeTotal = Math.max(0, range[1] - range[0] + 1);
  const { completeCount, failedCount } = countRangeProgress(
    galleryRecord,
    range[0],
    range[1]
  );
  const missingCount = Math.max(0, rangeTotal - completeCount);
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

              <motion.div
                className="mt-auto flex flex-wrap gap-1.5 text-xs text-muted-soft"
                initial="initial"
                animate="animate"
                variants={staggerContainer}
              >
                {galleryMeta.map((item) => (
                  <motion.span
                    key={item}
                    variants={staggerItem}
                    className="max-w-full truncate rounded-full border border-[var(--eh-hairline)] px-2 py-0.5 text-[11px] font-normal text-muted"
                  >
                    {item}
                  </motion.span>
                ))}
              </motion.div>
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
            <RangeProgressSection
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
        className={`${coverFrameClass} flex items-center justify-center`}
        role="img"
        aria-label={name ? `${name} cover unavailable` : 'Cover unavailable'}
      >
        <div className="eh-cover-fallback absolute inset-0" aria-hidden />
        <ImageOff
          size={28}
          strokeWidth={1.5}
          className="relative z-[1] text-muted-soft"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className={coverFrameClass}>
      {!isLoaded ? <div className="eh-cover-skeleton absolute inset-0" aria-hidden /> : null}
      <img
        src={src}
        alt={name ? `${name} cover` : ''}
        className={`h-full w-full object-cover transition-opacity duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        draggable={false}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
};

/**
 * 下载前：展示「所选范围」的历史状态，避免套用结果页的「完成/失败」语义。
 * - 从未下载过 → 待下载 N
 * - 有记录 → 已下载 / 失败 / 待下载 分项
 * - missingCount 仍只驱动「补下载」CTA
 */
const RangeProgressSection = ({
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
}) => {
  const allComplete = rangeTotal > 0 && completeCount >= rangeTotal;
  const pendingCount = Math.max(0, rangeTotal - completeCount - failedCount);
  const untouched = completeCount === 0 && failedCount === 0;

  return (
    <section className="shrink-0 border-t border-[var(--eh-hairline)] bg-[var(--eh-hover-bg)]/40 px-3 py-2.5">
      <div className="flex items-center gap-2 rounded-eh-sm border border-[var(--eh-hairline)] bg-surface px-2.5 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-[10px]">
          <span className="shrink-0 font-medium text-muted">{t('selectedRange')}</span>
          <span className="shrink-0 rounded-full border border-[var(--eh-hairline)] bg-[var(--eh-hover-bg)] px-1.5 py-px font-mono text-ink">
            {range[0]}-{range[1]}
          </span>
          <span className="text-[var(--eh-hairline)]" aria-hidden>
            ·
          </span>
          {allComplete ? (
            <span className="shrink-0 font-medium text-success">{t('rangeAllDownloaded')}</span>
          ) : untouched ? (
            <span className="shrink-0 font-medium text-muted">
              {t('countPendingShort', String(rangeTotal))}
            </span>
          ) : (
            <>
              {completeCount > 0 ? (
                <span className="shrink-0 font-medium text-ink">
                  {t('countDownloadedRatio', [String(completeCount), String(rangeTotal)])}
                </span>
              ) : null}
              {completeCount > 0 && failedCount > 0 ? (
                <span className="text-[var(--eh-hairline)]" aria-hidden>
                  ·
                </span>
              ) : null}
              {failedCount > 0 ? (
                <span className="shrink-0 font-medium text-error">
                  {t('countFailedShort', String(failedCount))}
                </span>
              ) : null}
              {(completeCount > 0 || failedCount > 0) && pendingCount > 0 ? (
                <span className="text-[var(--eh-hairline)]" aria-hidden>
                  ·
                </span>
              ) : null}
              {pendingCount > 0 ? (
                <span className="shrink-0 font-medium text-muted">
                  {t('countPendingShort', String(pendingCount))}
                </span>
              ) : null}
            </>
          )}
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
};
