import logoSrc from 'data-base64:~assets/pic-logo.png';

import { DownloadSettings } from '@/components/download-settings';
import { SegmentedTabs } from '@/components/ui-primitives';
import { t } from '@/utils/i18n';

const POPUP_TABS = [
  { id: 'info', label: t('galleryTab') },
  { id: 'history', label: t('historyTab') },
] as const;

export const PopupHeader = ({
  selectedTab,
  onSelectTab,
}: {
  selectedTab: string;
  onSelectTab: (key: string) => void;
}) => (
  <header className="grid h-popup-header shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 text-ink">
    <div className="flex min-w-0 items-center gap-2">
      <img
        src={logoSrc}
        alt=""
        className="h-7 w-7 shrink-0 rounded-eh-xs object-contain"
        aria-hidden
      />
      <span className="min-w-0 truncate text-[15px] font-medium tracking-tight text-ink">
        E-Hentai <span className="text-[rgb(var(--eh-brand-helper))]">Helper</span>
      </span>
    </div>
    <nav className="z-10 justify-self-center" aria-label="popup sections">
      <SegmentedTabs
        items={POPUP_TABS}
        selectedKey={selectedTab}
        onSelectionChange={onSelectTab}
        ariaLabel="popup tabs"
        layoutId="popup-tabs-active-bg"
      />
    </nav>
    <div className="min-w-0 justify-self-end">
      <DownloadSettings />
    </div>
  </header>
);
