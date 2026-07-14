import { useState } from 'react';
import { toast } from 'sonner';

import { AppShell } from '@/app';
import { EhButton } from '@/components/eh-button';
import { Settings, validateFilePath } from '@/components/settings';
import { useMounted } from '@/hooks';
import { configStorage } from '@/storage';
import { type Config, DEFAULT_CONFIG } from '@/utils';
import { t } from '@/utils/i18n';

export const OptionsPage = () => {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);

  useMounted(() => {
    configStorage.get().then((items) => {
      setConfig({ ...DEFAULT_CONFIG, ...items });
    });
  });

  const handleSave = () => {
    const intermediateDownloadPath = validateFilePath(config.intermediateDownloadPath);
    if (!intermediateDownloadPath) {
      toast.error(t('invalidFilePath'));
      return;
    }
    const updatedConfig = { ...config, intermediateDownloadPath };
    setConfig(updatedConfig);
    configStorage.set(updatedConfig).then(() => toast.success(t('saved')));
  };

  return (
    <AppShell>
      <div className="options-root">
        <div className="options-shell">
          <header className="options-header">
            <div className="options-header__text">
              <p className="options-header__eyebrow">E-Hentai Helper</p>
              <h1 className="options-header__title">{t('settings')}</h1>
              <p className="options-header__desc">{t('optionsSubtitle')}</p>
            </div>
          </header>
          <main className="options-main scrollbar-glass">
            <Settings
              config={config}
              setConfig={setConfig}
              variant="page"
              pathPreview={`${config.intermediateDownloadPath}${t('pathPreviewExample')}`}
            />
          </main>
          <footer className="options-footer">
            <EhButton variant="primary" ehSize="md" onPress={handleSave}>
              {t('saveChanges')}
            </EhButton>
          </footer>
        </div>
      </div>
    </AppShell>
  );
};

export default OptionsPage;
