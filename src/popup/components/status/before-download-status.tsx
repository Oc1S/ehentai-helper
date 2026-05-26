import { DownloadIcon } from '@/components/icons/DownloadIcon';
import { PageSelector } from '@/components/page-selector';

import { DownloadCard } from './download-card';
import { MetaBadge } from './meta-badge';

export const BeforeDownloadStatus = ({
  galleryTitle,
  totalImages,
  numPages,
  range,
  setRange,
  downloadCount,
  onDownload,
}: {
  galleryTitle: string;
  totalImages: number;
  numPages: number;
  range: [number, number];
  setRange: (range: [number, number]) => void;
  downloadCount: number;
  onDownload: () => void;
}) => (
  <DownloadCard>
    <div className="border-b border-surface-strong bg-surface-soft px-5 py-4">
      <h2
        className="line-clamp-2 text-[17px] font-semibold leading-snug text-ink"
        title={galleryTitle}
      >
        {galleryTitle}
      </h2>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <MetaBadge>{totalImages} images</MetaBadge>
        <MetaBadge>{numPages} pages</MetaBadge>
      </div>
    </div>

    {range[1] > 0 && (
      <div className="border-b border-surface-strong px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-soft">
            Image range
          </span>
          <span className="text-xs font-medium text-brand-accent">
            {range[0]} – {range[1]}
          </span>
        </div>
        <PageSelector range={range} setRange={setRange} maxValue={totalImages} />
      </div>
    )}

    <div className="bg-surface-card px-5 py-4">
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-cal-md border border-surface-strong bg-surface-soft px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">
            Selected
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-accent">
            {downloadCount}
          </p>
        </div>
        <div className="rounded-cal-md border border-surface-strong bg-surface-soft px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">Total</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{totalImages}</p>
        </div>
      </div>
      <button type="button" className="btn-primary" onClick={onDownload}>
        <DownloadIcon />
        Start Download
      </button>
    </div>
  </DownloadCard>
);
