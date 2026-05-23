import { Button } from '@nextui-org/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { AppShell } from '@/app';
import { useMounted } from '@/shared';
import { configStorage, defaultConfig, type Config } from '@/storage';

import { Settings, validateFilePath } from './Settings';

export const OptionsPage = () => {
  const [config, setConfig] = useState<Config>(defaultConfig);

  useMounted(() => {
    configStorage.get().then((items) => {
      setConfig(items as Config);
    });
  });

  const handleSave = () => {
    const intermediateDownloadPath = validateFilePath(config.intermediateDownloadPath);
    if (!intermediateDownloadPath) {
      toast.error('File path should not contain: * ? " < > |');
      return;
    }
    const updatedConfig = { ...config, intermediateDownloadPath };
    setConfig(updatedConfig);
    configStorage.set(updatedConfig).then(() => toast.success('Saved'));
  };

  return (
    <AppShell>
      <div className="options-root">
        <div className="options-shell">
          <header className="options-header">
            <div className="options-header__text">
              <h1 className="options-header__title">Settings</h1>
              <p className="options-header__desc">E-Hentai Helper · Download preferences</p>
            </div>
            <Button color="primary" onPress={handleSave}>
              Save changes
            </Button>
          </header>
          <main className="options-main scrollbar-glass">
            <p className="settings-section-title">General</p>
            <Settings config={config} setConfig={setConfig} variant="page" />
          </main>
        </div>
      </div>
    </AppShell>
  );
};

export default OptionsPage;
