import type { ReactNode } from 'react';

import { EhDownloadResultProgress } from '@/components/eh-progress';
import { t } from '@/utils/i18n';

export type ResultVariant = 'success' | 'partial' | 'failed';

export const DownloadResultSummary = ({
  variant,
  galleryName,
  downloadCount,
  completeCount,
  failedCount,
  rangeStart,
  rangeEnd,
  children,
}: {
  variant: ResultVariant;
  galleryName: string;
  downloadCount: number;
  completeCount: number;
  failedCount: number;
  rangeStart: number;
  rangeEnd: number;
  children?: ReactNode;
}) => {
  const statusLabel =
    variant === 'success'
      ? t('downloadCompleted')
      : variant === 'partial'
        ? t('partiallyCompleted')
        : t('downloadFailedTitle');

  const statusClass =
    variant === 'success'
      ? 'text-success'
      : variant === 'partial'
        ? 'text-warning'
        : 'text-error';

  const desc =
    variant === 'success'
      ? t('allImagesSuccess', String(downloadCount))
      : variant === 'partial'
        ? t('partialSuccessSummary', [String(completeCount), String(failedCount)])
        : t('downloadFailedDesc');

  return (
    <div className="glass-panel rounded-eh-2xl flex shrink-0 flex-col gap-3 p-5">
      <div className="min-w-0 text-left">
        <h3 className="break-words text-[15px] font-bold leading-snug tracking-tight text-ink">
          {galleryName}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-soft">
          <span>{t('thisDownloadRange')}</span>
          <span className="rounded-full border border-hairline px-2 py-0.5 font-mono text-xs font-normal text-ink">
            {rangeStart} - {rangeEnd}
          </span>
          <span>
            · {downloadCount} {t('imagesLabel')}
          </span>
        </p>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={`text-xs font-normal uppercase tracking-wide ${statusClass}`}>
            {statusLabel}
          </p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${statusClass}`}>
            {completeCount}
            <span className="text-sm font-normal text-muted"> / {downloadCount}</span>
          </p>
        </div>
        {variant !== 'success' && failedCount > 0 ? (
          <div className="text-right">
            <p className="text-xs font-normal uppercase tracking-wide text-muted-soft">
              {t('stateFailed')}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-error">{failedCount}</p>
          </div>
        ) : null}
      </div>

      <EhDownloadResultProgress
        downloadCount={downloadCount}
        completeCount={completeCount}
        failedCount={failedCount}
      />

      <p className="text-xs leading-relaxed text-muted">{desc}</p>
      {children}
    </div>
  );
};
