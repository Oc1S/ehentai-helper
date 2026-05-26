import { Link } from '@nextui-org/react';

import { StatusCard } from '@/components/status-card';

import { LinkIcon } from '../icons';

export const OtherPageStatus = () => (
  <StatusCard
    variant="info"
    icon={<LinkIcon />}
    title="Navigate to Gallery"
    description="Visit a gallery page to start downloading"
  >
    <div className="body-sm flex items-center justify-center gap-2">
      <span>Go to</span>
      <Link
        href="https://e-hentai.org/"
        isExternal
        className="font-medium text-brand-accent underline underline-offset-2"
      >
        E-Hentai
      </Link>
      <span className="text-[11px] text-muted-soft">or</span>
      <Link
        href="https://exhentai.org/"
        isExternal
        className="font-medium text-brand-accent underline underline-offset-2"
      >
        ExHentai
      </Link>
    </div>
  </StatusCard>
);
