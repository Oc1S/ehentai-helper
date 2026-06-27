import { DownloadSettings } from '@/components/download-settings';
import { t } from '@/utils/i18n';

const POPUP_TABS = [
  { key: 'info', label: () => t('galleryTab') },
  { key: 'history', label: () => t('historyTab') },
] as const;

export const PopupHeader = ({
  selectedTab,
  onSelectTab,
  isDownloading,
  pathPreview,
}: {
  selectedTab: string;
  onSelectTab: (key: string) => void;
  isDownloading: boolean;
  pathPreview?: string;
}) => (
  <header className="grid h-popup-header shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4">
    <span className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-ink">
      E-Hentai <span className="text-brand-accent">Helper</span>
    </span>
    <nav role="tablist" aria-label="popup tabs" className="z-10 justify-self-center">
      <div className="flex items-center gap-0.5 rounded-full border border-[var(--eh-glass-border)] bg-[rgb(8_8_9/0.35)] p-0.5">
        {POPUP_TABS.map((tab) => {
          const isActive = selectedTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectTab(tab.key)}
              className={`flex h-8 items-center gap-1 rounded-full px-3 text-xs font-normal transition-colors ${
                isActive ? 'bg-surface-card text-ink shadow-card' : 'text-muted hover:text-body'
              }`}
            >
              {tab.label()}
            </button>
          );
        })}
      </div>
    </nav>
    <div className="min-w-0 justify-self-end">
      <DownloadSettings disabled={isDownloading} pathPreview={pathPreview} />
    </div>
  </header>
);
