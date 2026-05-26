import { Spinner } from '@nextui-org/react';

import { DownloadCard } from './download-card';
import { DownloadProgress } from './download-progress';

export const DownloadingStatus = ({
  galleryTitle,
  downloadCount,
  finishedCount,
}: {
  galleryTitle: string;
  downloadCount: number;
  finishedCount: number;
}) => (
  <DownloadCard>
    <div className="border-b border-surface-strong bg-surface-soft px-5 py-4">
      <h3 className="line-clamp-2 text-[15px] font-semibold text-ink">{galleryTitle}</h3>
      <div className="mt-2 flex items-center gap-2">
        <Spinner size="sm" color="primary" />
        <span className="text-[13px] font-medium text-muted">Downloading images...</span>
      </div>
    </div>
    <div className="px-5 py-4">
      <DownloadProgress downloadCount={downloadCount} finishedCount={finishedCount} />
    </div>
  </DownloadCard>
);
