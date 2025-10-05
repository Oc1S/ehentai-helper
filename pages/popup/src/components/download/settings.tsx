import { useState } from 'react';
import {
  Config,
  defaultConfig,
  PATTERN_INVALID_FILE_PATH_CHAR,
  useMounted,
  useStorageSuspense,
} from '@ehentai-helper/shared';
import {
  Button,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Radio,
  RadioGroup,
  Tooltip,
  useDisclosure,
} from '@nextui-org/react';
import { toast } from 'sonner';

interface DownloadSettingsProps {
  trigger?: React.ReactNode;
}

const validateFilePath = (path: string) => {
  if (PATTERN_INVALID_FILE_PATH_CHAR.test(path)) {
    return null;
  }
  path = path.replace(/\\/g, '/');
  if (path[path.length - 1] !== '/') {
    path += '/';
  }
  return path;
};

export const DownloadSettings = ({ trigger }: DownloadSettingsProps) => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [saveStatus, setSaveStatus] = useState<string>('');

  useMounted(() => {
    chrome.storage.sync.get(defaultConfig, items => {
      setConfig(items as Config);
    });
  });

  const handleSave = () => {
    const intermediateDownloadPath = validateFilePath(config.intermediateDownloadPath);

    if (!intermediateDownloadPath) {
      toast.error('File path should not contain: * ? " < > |');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }

    const updatedConfig = { ...config, intermediateDownloadPath };
    setConfig(updatedConfig);
    chrome.storage.sync.set(updatedConfig, () => {
      toast.success('Settings saved successfully!');
    });
  };

  const showDefaultDownloadFolder = () => {
    chrome.downloads.showDefaultFolder();
  };

  return (
    <>
      {trigger ? (
        <div onClick={onOpen} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <Button
          size="sm"
          variant="flat"
          className="fixed right-4 top-4 border border-slate-600/30 bg-slate-800/60 text-slate-200 shadow-lg backdrop-blur-sm transition-all duration-200 hover:border-slate-500/50 hover:bg-slate-700/80 hover:shadow-xl"
          onPress={onOpen}>
          Settings
        </Button>
      )}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside" classNames={{}}>
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader className="flex flex-col gap-1">Download Settings</ModalHeader>
              <ModalBody className="space-y-6"></ModalBody>
              <ModalFooter className="gap-3">
                <Button
                  variant="light"
                  onPress={onClose}
                  className="text-slate-300 transition-all duration-200 hover:bg-slate-700/50 hover:text-slate-100">
                  Cancel
                </Button>

                <Button
                  color="primary"
                  onPress={handleSave}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 font-semibold text-white shadow-lg transition-all duration-200 hover:from-blue-500 hover:to-blue-400 hover:shadow-xl">
                  Save Settings
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};
