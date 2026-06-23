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
  path = path.replace(/\\/g, '/');
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
        size="sm"
        variant="flat"
        onPress={onOpen}
        isDisabled={disabled}
        className="h-7 min-w-0 border border-[var(--eh-glass-border)] bg-[rgb(8_8_9/0.35)] px-3 text-[12px] font-medium text-muted backdrop-blur-sm hover:border-[var(--eh-glass-border-hover)] hover:bg-[rgb(12_12_13/0.45)] hover:text-body"
      >
        {t('settings')}
      </Button>

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="2xl"
        scrollBehavior="inside"
        backdrop="blur"
        classNames={{
          backdrop: 'bg-[rgb(0_0_0/0.58)] backdrop-blur-md',
          wrapper: 'items-center px-4',
          base: 'border-0 bg-transparent shadow-none',
        }}
      >
        <ModalContent className="glass-panel my-3 max-h-[min(540px,88vh)] border border-[var(--eh-glass-border)] bg-transparent shadow-[var(--eh-glass-elevation)]">
          {(close) => (
            <>
              <ModalHeader className="flex flex-col gap-1 border-b border-[var(--eh-hairline-soft)] px-6 py-4">
                <span className="text-base font-semibold tracking-tight text-ink">
                  {t('downloadSettings')}
                </span>
                <span className="text-[11px] font-medium text-muted-soft">
                  {t('optionsSubtitle')}
                </span>
              </ModalHeader>
              <ModalBody className="scrollbar-glass px-6 py-5">
                <Settings config={config} setConfig={setConfig} pathPreview={pathPreview} />
              </ModalBody>
              <ModalFooter className="gap-2 border-t border-[var(--eh-hairline-soft)] bg-[rgb(8_8_9/0.28)] px-6 py-3 backdrop-blur-md">
                <Button
                  variant="flat"
                  onPress={close}
                  className="border border-[var(--eh-glass-border)] bg-[rgb(8_8_9/0.3)] font-medium text-muted hover:text-body"
                >
                  {t('cancel')}
                </Button>
                <Button
                  color="primary"
                  onPress={handleSave}
                  className="font-semibold shadow-[var(--eh-shadow-card)]"
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
