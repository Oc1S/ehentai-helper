import type { ReactNode } from 'react';

import { t } from '@/utils/i18n';

type EhProgressBarProps = {
  value: number;
  max: number;
  successPercent?: number;
  failedPercent?: number;
  ariaLabel: string;
  className?: string;
};

/** 单色或双色（成功 + 失败）原生进度条 */
export const EhProgressBar = ({
  value,
  max,
  successPercent,
  failedPercent,
  ariaLabel,
  className = '',
}: EhProgressBarProps) => {
  const isSegmented = successPercent !== undefined || failedPercent !== undefined;
  const successWidth = successPercent ?? 0;
  const failedWidth = failedPercent ?? 0;

  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div
      className={`flex h-2 w-full overflow-hidden rounded-full bg-[rgba(23,23,28,0.1)] ${className}`.trim()}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={ariaLabel}
    >
      {isSegmented ? (
        <>
          {successWidth > 0 ? (
            <div
              className="h-full bg-success motion-safe:transition-[width] motion-safe:duration-300"
              style={{ width: `${successWidth}%` }}
            />
          ) : null}
          {failedWidth > 0 ? (
            <div
              className="h-full bg-error motion-safe:transition-[width] motion-safe:duration-300"
              style={{ width: `${failedWidth}%` }}
            />
          ) : null}
        </>
      ) : (
        <div
          className="h-full bg-primary motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${percent}%` }}
        />
      )}
    </div>
  );
};

export const EhDownloadProgressPanel = ({
  downloadCount,
  completeCount,
  failedCount,
  inProgressCount,
}: {
  downloadCount: number;
  completeCount: number;
  failedCount: number;
  inProgressCount: number;
}) => {
  const settledCount = completeCount + failedCount;
  const percent = downloadCount > 0 ? Math.round((settledCount / downloadCount) * 100) : 0;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-normal uppercase tracking-wide text-muted-soft">
            {t('progress')}
          </p>
          <p className="mt-1 text-2xl font-medium tabular-nums text-primary">{percent}%</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-normal uppercase tracking-wide text-muted-soft">
            {t('completed')}
          </p>
          <p className="mt-1 text-lg font-medium tabular-nums text-ink">
            {completeCount}
            <span className="text-sm font-normal text-muted"> / {downloadCount}</span>
          </p>
        </div>
      </div>
      <EhProgressBar
        value={settledCount}
        max={downloadCount}
        ariaLabel={t('downloadProgress')}
      />
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-soft">
        <span className="text-success">{t('badgeComplete', String(completeCount))}</span>
        <span aria-hidden>·</span>
        <span className="text-warning">{t('badgeInProgress', String(inProgressCount))}</span>
        <span aria-hidden>·</span>
        <span className="text-error">{t('badgeFailed', String(failedCount))}</span>
      </div>
    </div>
  );
};

export const EhDownloadResultProgress = ({
  downloadCount,
  completeCount,
  failedCount,
  children,
}: {
  downloadCount: number;
  completeCount: number;
  failedCount: number;
  children?: ReactNode;
}) => {
  const successWidth = downloadCount > 0 ? (completeCount / downloadCount) * 100 : 0;
  const failedWidth = downloadCount > 0 ? (failedCount / downloadCount) * 100 : 0;

  return (
    <>
      <EhProgressBar
        value={completeCount}
        max={downloadCount}
        successPercent={successWidth}
        failedPercent={failedWidth}
        ariaLabel={t('downloadProgress')}
      />
      {children}
    </>
  );
};
