import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings as SettingsIcon, X } from 'lucide-react';
import { toast } from 'sonner';

import { useMounted } from '@/hooks';
import { configStorage } from '@/storage';
import { type Config, DEFAULT_CONFIG, PATTERN_INVALID_FILE_PATH_CHAR } from '@/utils';
import { t } from '@/utils/i18n';
import { overlayEnter } from '@/utils/motion';

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

const settingsOverlayMotion = {
  ...overlayEnter,
  initial: { ...overlayEnter.initial, pointerEvents: 'auto' as const },
  animate: { ...overlayEnter.animate, pointerEvents: 'auto' as const },
  exit: { ...overlayEnter.exit, pointerEvents: 'none' as const },
} as const;

export const DownloadSettings = () => {
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
      toast.success(t('saved'));
      setIsOpen(false);
    });
  };

  const settingsOverlay = (
    <AnimatePresence>
      {isOpen ? (
        <motion.section
          className="eh-settings-overlay fixed inset-0 z-50 flex h-full w-full flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
          {...settingsOverlayMotion}
        >
          <header className="flex h-popup-header shrink-0 items-center justify-between gap-3 px-4">
            <div className="min-w-0">
              <h1
                id="eh-popup-settings-title"
                className="truncate text-[15px] font-semibold tracking-tight text-ink"
              >
                {t('settings')}
              </h1>
            </div>
            <EhButton
              isIconOnly
              ehSize="sm"
              onPress={() => setIsOpen(false)}
              aria-label={t('close')}
              className="ml-3"
            >
              <X size={16} strokeWidth={1.9} />
            </EhButton>
          </header>

          <div className="scrollbar-glass min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <Settings config={config} setConfig={setConfig} variant="overlay" />
          </div>

          <footer className="flex h-popup-footer shrink-0 items-center justify-end gap-2 border-t border-[var(--eh-hairline)] bg-transparent px-5 py-2.5">
            <EhButton variant="secondary" ehSize="sm" onPress={() => setIsOpen(false)}>
              {t('cancel')}
            </EhButton>
            <EhButton variant="primary" ehSize="sm" onPress={handleSave}>
              {t('saveChanges')}
            </EhButton>
          </footer>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
      <EhButton
        isIconOnly
        ehSize="sm"
        onPress={() => setIsOpen(true)}
        aria-label={t('settings')}
      >
        <SettingsIcon size={15} strokeWidth={1.75} />
      </EhButton>

      {createPortal(settingsOverlay, document.body)}
    </>
  );
};
