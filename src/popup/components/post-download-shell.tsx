import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

import { EhButton } from '@/components/eh-button';
import { t } from '@/utils/i18n';

import { DownloadResultSummary, type ResultVariant } from './download-result-summary';

export const PostDownloadShell = ({
  variant,
  galleryName,
  downloadCount,
  completeCount,
  failedCount,
  rangeStart,
  rangeEnd,
  footerActions,
}: {
  variant: ResultVariant;
  galleryName: string;
  downloadCount: number;
  completeCount: number;
  failedCount: number;
  rangeStart: number;
  rangeEnd: number;
  footerActions?: ReactNode;
}) => (
  <div className="flex h-full min-h-0 w-full flex-col px-4 py-4">
    <div className="scrollbar-glass flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-3">
      <DownloadResultSummary
        variant={variant}
        galleryName={galleryName}
        downloadCount={downloadCount}
        completeCount={completeCount}
        failedCount={failedCount}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
      >
        {variant === 'success' ? (
          <a
            href="https://github.com/Oc1S/ehentai-helper"
            target="_blank"
            rel="noreferrer"
            className="eh-github-star-link group"
          >
            <span className="eh-github-star-link__text">
              {t('enjoyingExtension')}
              {t('starGithubLink')}
            </span>
            <ExternalLink className="eh-github-star-link__icon size-4 shrink-0" aria-hidden />
          </a>
        ) : null}
      </DownloadResultSummary>
    </div>
    <div className="min-h-popup-footer flex shrink-0 flex-col justify-center gap-2 border-t border-[var(--eh-hairline-soft)] pt-3">
      {footerActions}
    </div>
  </div>
);

export const RetryPrimaryButton = ({ count, onPress }: { count: number; onPress: () => void }) => (
  <EhButton variant="primary" ehSize="md" fullWidth onPress={onPress}>
    {t('retryAllFailed', String(count))}
  </EhButton>
);

export const PostDownloadActionRow = ({
  leading,
  retryCount,
  onRetry,
}: {
  leading: ReactNode;
  retryCount: number;
  onRetry: () => void;
}) => (
  <div className="flex items-stretch gap-2">
    {leading}
    <div className="min-w-0 flex-1">
      <RetryPrimaryButton count={retryCount} onPress={onRetry} />
    </div>
  </div>
);
