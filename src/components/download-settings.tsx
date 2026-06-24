import { useState } from 'react';
import {
  Button,
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
      <Button
        isIconOnly
        size="sm"
        variant="flat"
        onPress={onOpen}
        isDisabled={disabled}
        aria-label={t('settings')}
        className="h-7 w-7 min-w-0 border border-[var(--eh-glass-border)] bg-[rgb(8_8_9/0.35)] text-muted backdrop-blur-sm hover:border-[var(--eh-glass-border-hover)] hover:bg-[rgb(12_12_13/0.45)] hover:text-body"
      >
        <SettingsIcon size={15} strokeWidth={1.75} />
      </Button>

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
                <Button
                  variant="light"
                  onPress={close}
                  className="h-8 min-w-[68px] flex-none rounded-lg border border-[var(--eh-glass-border)] bg-[rgb(12_12_13/0.4)] px-3.5 text-[12px] font-normal text-muted backdrop-blur-sm hover:bg-[rgb(16_16_18/0.5)] hover:text-body"
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="light"
                  onPress={handleSave}
                  className="bg-brand-accent/12 hover:bg-brand-accent/18 h-8 min-w-[68px] flex-none rounded-lg border border-brand-accent/30 px-3.5 text-[12px] font-normal text-brand-accent backdrop-blur-sm"
                >
                  {t('saveSettings')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};
