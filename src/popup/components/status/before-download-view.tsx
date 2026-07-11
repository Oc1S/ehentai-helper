import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

import { EhButton } from '@/components/eh-button';
import type { GalleryInfo, GalleryRecord } from '@/storage';
import { t } from '@/utils/i18n';

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
  // 与下载中/结果页同一套范围进度模型：主指标永远是「完成/总数」
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

/**
 * 范围进度：与下载中/结果页同一语义。
 * - 主指标：完成 / 总数（正向进度）
 * - 失败：仅作补充信息
 * - 缺失：只驱动「补下载」CTA，不再作为主展示数字
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

  return (
    <section className="shrink-0 border-t border-[var(--eh-hairline)] bg-[var(--eh-hover-bg)]/40 px-3 py-2.5">
      <div className="flex items-center gap-2 rounded-eh-sm border border-[var(--eh-hairline)] bg-surface px-2.5 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 text-[10px] font-medium text-muted">{t('thisDownloadRange')}</span>
          <span className="shrink-0 rounded-full border border-[var(--eh-hairline)] bg-[var(--eh-hover-bg)] px-1.5 py-px font-mono text-[10px] text-ink">
            {range[0]}-{range[1]}
          </span>
          <span className="text-[var(--eh-hairline)]">·</span>
          <span className="shrink-0 text-[10px] text-muted-soft">{t('stateComplete')}</span>
          <span
            className={`shrink-0 text-sm font-semibold tabular-nums leading-none ${
              allComplete ? 'text-success' : 'text-ink'
            }`}
          >
            {completeCount}
            <span className="text-xs font-normal text-muted-soft">/{rangeTotal}</span>
          </span>
          {failedCount > 0 ? (
            <>
              <span className="text-[var(--eh-hairline)]">·</span>
              <span className="shrink-0 text-[10px] text-muted-soft">{t('stateFailed')}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums leading-none text-error">
                {failedCount}
              </span>
            </>
          ) : null}
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
