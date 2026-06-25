import { useState } from 'react';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from '@nextui-org/react';
import { Settings as SettingsIcon } from 'lucide-react';
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
  const { isOpen, onClose, onOpen, onOpenChange } = useDisclosure();
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);

  useMounted(() => {
    configStorage.get().then((items) => {
      setConfig({ ...DEFAULT_CONFIG, ...items });
    });
  });

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
      onClose();
    });
  };

  return (
    <>
      <EhButton
        appearance="icon"
        ehSize="sm"
        onPress={onOpen}
        isDisabled={disabled}
        aria-label={t('settings')}
      >
        <SettingsIcon size={15} strokeWidth={1.75} />
      </EhButton>

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="xl"
        scrollBehavior="inside"
        backdrop="blur"
        hideCloseButton
        classNames={{
          backdrop: 'bg-[rgb(0_0_0/0.58)] backdrop-blur-md',
          wrapper: 'items-center px-4',
          base: 'border-0 bg-transparent shadow-none',
        }}
      >
        <ModalContent className="glass-panel my-3 max-h-[min(540px,88vh)] border border-[var(--eh-glass-border)] bg-transparent shadow-[var(--eh-glass-elevation)]">
          {(close) => (
            <>
              <ModalHeader className="border-b border-[var(--eh-hairline-soft)] px-5 py-3">
                <span className="text-sm font-medium tracking-tight text-ink">{t('settings')}</span>
              </ModalHeader>
              <ModalBody className="scrollbar-glass px-5 py-4">
                <Settings config={config} setConfig={setConfig} pathPreview={pathPreview} />
              </ModalBody>
              <ModalFooter className="flex flex-row justify-end gap-2 border-t border-[var(--eh-hairline-soft)] bg-[rgb(8_8_9/0.28)] px-5 py-2.5 backdrop-blur-md">
                <EhButton appearance="ghost" ehSize="sm" onPress={close}>
                  {t('cancel')}
                </EhButton>
                <EhButton appearance="primary" ehSize="sm" onPress={handleSave}>
                  {t('saveSettings')}
                </EhButton>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};
