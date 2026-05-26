import type { ReactNode } from 'react';

const DOWNLOAD_CARD_WIDTH = 'w-[480px]';

export const DownloadCard = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={`flex w-full shrink-0 justify-center px-4 py-4 ${className}`.trim()}>
    <div
      className={`${DOWNLOAD_CARD_WIDTH} shrink-0 overflow-hidden rounded-cal-xl border border-surface-strong bg-surface-card shadow-card-elevated`}
    >
      {children}
    </div>
  </div>
);
