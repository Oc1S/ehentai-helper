import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from '@nextui-org/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { PATTERN_INVALID_FILE_PATH_CHAR, useMounted } from '@/shared';
import { configStorage, type Config, defaultConfig } from '@/storage';
import { Settings } from './Settings';

const formatDownloadDir = (path: string) => {
  if (PATTERN_INVALID_FILE_PATH_CHAR.test(path)) {
    return null;
  }
  path = path.replace(/\\/g, '/');
  if (path[path.length - 1] !== '/') {
    path += '/';
  }
  return path;
};

export const DownloadSettings = () => {
  const { isOpen, onClose, onOpen, onOpenChange } = useDisclosure();
  const [config, setConfig] = useState<Config>(defaultConfig);

  useMounted(() => {
    configStorage.get().then((items) => {
      setConfig(items as Config);
    });
  });

  const handleSave = () => {
    const intermediateDownloadPath = formatDownloadDir(config.intermediateDownloadPath);

    if (!intermediateDownloadPath) {
      toast.error('File path should not contain: * ? " < > |');
      return;
    }

    const updatedConfig = { ...config, intermediateDownloadPath };
    setConfig(updatedConfig);

    configStorage.set(updatedConfig).then(() => {
      toast.success('Settings saved successfully!');
      onClose();
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="flat"
        className="border border-slate-600/30 bg-slate-800/60 text-slate-200 shadow-lg backdrop-blur-sm transition-all duration-200 hover:border-slate-500/50 hover:bg-slate-700/80 hover:shadow-xl"
        onPress={onOpen}
      >
        Settings
      </Button>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Download Settings</ModalHeader>
              <ModalBody className="space-y-6">
                <Settings config={config} setConfig={setConfig} />
              </ModalBody>
              <ModalFooter className="gap-3">
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button onPress={handleSave}>Save Settings</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};
