import { Info, Link2, X } from 'lucide-react';

import { EhButton } from '@/components/eh-button';
import { StatusCard } from '@/components/status-card';
import { t } from '@/utils/i18n';

const ICON_STROKE = 1.5;

export const EHentaiOtherStatusView = () => (
  <StatusCard
    variant="warning"
    icon={<Info size={24} strokeWidth={ICON_STROKE} />}
    title={t('notOnGalleryPage')}
    description={t('notOnGalleryDesc')}
  />
);

export const OtherPageStatusView = () => (
  <StatusCard
    variant="info"
    icon={<Link2 size={24} strokeWidth={ICON_STROKE} />}
    title={t('openGalleryFirst')}
    description={t('openGalleryDesc')}
  >
    <div className="grid w-full max-w-[280px] grid-cols-2 gap-2">
      <EhButton
        as="a"
        href="https://e-hentai.org/"
        target="_blank"
        rel="noreferrer"
        variant="primary"
        ehSize="sm"
        fullWidth
      >
        E-Hentai
      </EhButton>
      <EhButton
        as="a"
        href="https://exhentai.org/"
        target="_blank"
        rel="noreferrer"
        variant="primary"
        ehSize="sm"
        fullWidth
      >
        ExHentai
      </EhButton>
    </div>
  </StatusCard>
);

export const FailStatusView = ({ onReload }: { onReload: () => void }) => (
  <StatusCard
    variant="error"
    icon={<X size={24} strokeWidth={ICON_STROKE} />}
    title={t('unableReadGallery')}
    description={t('unableReadGalleryDesc')}
  >
    <EhButton variant="primary" ehSize="sm" onPress={onReload}>
      {t('refreshPage')}
    </EhButton>
  </StatusCard>
);
