import { Link } from '@nextui-org/react';

import { StatusCard } from '@/components/status-card';

import { CheckIcon } from '../icons';
import { DownloadCard } from './download-card';
import { DownloadProgress } from './download-progress';

export const DownloadSuccessStatus = ({
  galleryTitle,
  downloadCount,
  finishedCount,
}: {
  galleryTitle: string;
  downloadCount: number;
  finishedCount: number;
}) => (
  <DownloadCard className="py-2">
    <div className="border-b border-hairline-soft bg-surface-soft/70 px-5 py-4 text-center">
      <h3 className="line-clamp-2 text-[15px] font-semibold text-ink">{galleryTitle}</h3>
      <p className="mt-1 text-[13px] font-medium text-muted">All images downloaded successfully</p>
    </div>
    <div className="px-5 pt-2">
      <StatusCard
        variant="success"
        icon={<CheckIcon />}
        title="Download Completed!"
        description={
          <>
            Enjoying the extension?{' '}
            <Link
              href="https://github.com/Oc1S/ehentai-helper"
              isExternal
              className="font-medium text-brand-accent underline underline-offset-2"
            >
              Star it on GitHub
            </Link>
          </>
        }
        className="max-w-none border-0 bg-transparent px-0 py-4 shadow-none"
      />
    </div>
    <div className="border-t border-surface-strong px-5 py-4">
      <DownloadProgress downloadCount={downloadCount} finishedCount={finishedCount} />
    </div>
  </DownloadCard>
);
