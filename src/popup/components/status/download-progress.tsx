import { Progress } from '@nextui-org/react';

export const DownloadProgress = ({
  downloadCount,
  finishedCount,
}: {
  downloadCount: number;
  finishedCount: number;
}) => (
  <div className="w-full space-y-4">
    <div className="flex items-end justify-between">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">Progress</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-accent">
          {downloadCount > 0 ? Math.round((finishedCount / downloadCount) * 100) : 0}%
        </p>
      </div>
      <div className="text-right">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">Completed</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
          {finishedCount}
          <span className="text-sm font-medium text-muted"> / {downloadCount}</span>
        </p>
      </div>
    </div>
    <Progress
      aria-label="Download progress"
      value={finishedCount}
      minValue={0}
      maxValue={downloadCount}
      className="w-full"
      classNames={{
        track: 'h-2 border-s border-primary/20 bg-surface-strong',
        indicator: 'bg-brand-primary',
      }}
      color="primary"
      size="sm"
    />
    <p className="text-center text-[11px] text-muted-soft">
      {Math.max(0, downloadCount - finishedCount)} images remaining
    </p>
  </div>
);
