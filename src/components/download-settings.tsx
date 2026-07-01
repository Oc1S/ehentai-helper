import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';

import { useMounted } from '@/hooks';
import { configStorage } from '@/storage';
import { type Config, DEFAULT_CONFIG, PATTERN_INVALID_FILE_PATH_CHAR } from '@/utils';
import { t } from '@/utils/i18n';

import { EhButton } from './eh-button';
import { Settings } from './settings';

const formatDownloadDir = (path: string) => {
  if (PATTERN_INVALID_FILE_PATH_CHAR.test(path)) {
    return null;
  }
  path = path.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!path) return null;
  if (path[path.length - 1] !== '/') {
    path += '/';
  }
  return path;
};

export const DownloadSettings = ({
  disabled = false,
  pathPreview,
}: {
  disabled?: boolean;
  pathPreview?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);

  useMounted(() => {
    configStorage.get().then((items) => {
      setConfig({ ...DEFAULT_CONFIG, ...items });
    });
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSave = () => {
    const intermediateDownloadPath = formatDownloadDir(config.intermediateDownloadPath);

    if (!intermediateDownloadPath) {
      toast.error(t('invalidFilePath'));
      return;
    }

    const updatedConfig = { ...config, intermediateDownloadPath };
    setConfig(updatedConfig);

    configStorage.set(updatedConfig).then(() => {
      toast.success(t('settingsSaved'));
      setIsOpen(false);
    });
  };

  const settingsOverlay = isOpen ? (
    <section
      className="eh-settings-overlay fixed inset-0 z-50 flex h-full w-full flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eh-popup-settings-title"
    >
      <header className="eh-settings-overlay__header">
        <EhButton
          isIconOnly
          ehSize="sm"
          onPress={() => setIsOpen(false)}
          aria-label={t('close')}
          className="eh-settings-overlay__back"
        >
          <ArrowLeft size={16} strokeWidth={1.9} />
        </EhButton>
        <div className="min-w-0">
          <h1
            id="eh-popup-settings-title"
            className="truncate text-[15px] font-semibold tracking-tight text-ink"
          >
            {t('settings')}
          </h1>
          <p className="mt-0.5 truncate text-xs text-muted-soft">{t('downloadSettings')}</p>
        </div>
      </header>

      <div className="scrollbar-glass min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <Settings
          config={config}
          setConfig={setConfig}
          variant="overlay"
          pathPreview={pathPreview}
        />
      </div>

      <footer className="eh-settings-overlay__footer">
        <EhButton variant="primary" ehSize="sm" onPress={handleSave}>
          {t('saveSettings')}
        </EhButton>
      </footer>
    </section>
  ) : null;

  return (
    <>
      <EhButton
        isIconOnly
        ehSize="sm"
        onPress={() => setIsOpen(true)}
        disabled={disabled}
        aria-label={t('settings')}
      >
        <SettingsIcon size={15} strokeWidth={1.75} />
      </EhButton>

      {settingsOverlay ? createPortal(settingsOverlay, document.body) : null}
    </>
  );
};
