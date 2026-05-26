import { Spinner } from '@nextui-org/react';

export const LoadingStatus = () => (
  <div className="flex h-popup-content flex-col items-center justify-center gap-3">
    <Spinner size="lg" color="primary" />
    <p className="animate-pulse text-[13px] font-medium text-muted">Initializing...</p>
  </div>
);
