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
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-8 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-100">Options</h1>
          <Button color="primary" onPress={handleSave}>
            Save
          </Button>
        </div>
        <Settings config={config} setConfig={setConfig} />
      </div>
    </AppShell>
  );
};

export default OptionsPage;
