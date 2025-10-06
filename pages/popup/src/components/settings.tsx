import React, { FC, ReactNode, useState } from 'react';
import { Config, defaultConfig, PATTERN_INVALID_FILE_PATH_CHAR, useMounted } from '@ehentai-helper/shared';
import { Button, Checkbox, Input, Radio, RadioGroup, Tooltip } from '@nextui-org/react';
import { toast } from 'sonner';

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

const Row = ({ label, content }: Record<'label' | 'content', React.ReactNode>) => {
  return (
    <div className="flex items-center">
      <div className="flex w-[200px]">{label}:</div>
      <div className="w-[600px]">{content}</div>
    </div>
  );
};

const TextInput = ({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input type="text" className={`border-primary border-b bg-transparent text-gray-100 ${className}`} {...rest} />
);

export const Settings: FC = () => {
  const [config, setConfig] = useState<Config>(defaultConfig);

  const restoreOptions = () => {
    chrome.storage.sync.get(defaultConfig, items => {
      setConfig(items as Config);
    });
  };

  const saveOptions = () => {
    const intermediateDownloadPath = validateFilePath(config.intermediateDownloadPath);

    if (!intermediateDownloadPath) {
      toast.error(
        'Failed to save options. ' + 'File path should not contain the following characters ' + ': * ? " < > |'
      );
      return;
    }
    if (intermediateDownloadPath !== config.intermediateDownloadPath) {
      setConfig({ ...config, intermediateDownloadPath });
    }
    chrome.storage.sync.set(config, () => toast.success('Saved'));
  };

  useMounted(() => {
    restoreOptions();
  });

  const formItemMap: Record<keyof Config, { label: ReactNode; content: ReactNode }> = {
    intermediateDownloadPath: {
      label: (
        <span title="For security reasons, you can only set a directory inside the default download folder.">
          Download folder
        </span>
      ),
      content: (
        <div className="flex items-baseline">
          <div
            className="underline"
            onClick={() => {
              chrome.downloads.showDefaultFolder();
            }}>
            [Default download folder]/
          </div>
          <TextInput
            value={config.intermediateDownloadPath}
            onChange={e => setConfig({ ...config, intermediateDownloadPath: e.target.value })}
          />
        </div>
      ),
    },
    saveOriginalImages: {
      label: 'Save original images',
      content: (
        <Checkbox
          isSelected={config.saveOriginalImages}
          onChange={e => {
            setConfig({ ...config, saveOriginalImages: e.target.checked });
          }}
        />
      ),
    },
    saveGalleryInfo: {
      label: 'Save gallery information',
      content: (
        <div className="flex gap-4">
          <Checkbox
            isSelected={config.saveGalleryInfo}
            onChange={e => {
              setConfig({ ...config, saveGalleryInfo: e.target.checked });
            }}
          />
        </div>
      ),
    },
    filenameConflictAction: {
      label: (
        <Tooltip content="Action when filename conflict" closeDelay={200}>
          Filename conflict action
        </Tooltip>
      ),
      content: (
        <RadioGroup
          orientation="horizontal"
          value={config.filenameConflictAction}
          onValueChange={val =>
            setConfig({
              ...config,
              filenameConflictAction: val,
            })
          }>
          <Radio value="uniquify">Uniquify</Radio>
          <Radio value="overwrite">Overwrite</Radio>
        </RadioGroup>
      ),
    },
    downloadInterval: {
      label: (
        <span title="The interval between each image download. This is to avoid blocking due to high QPS.">
          Download interval
        </span>
      ),
      content: (
        <Input
          type="number"
          placeholder="300"
          value={String(config.downloadInterval)}
          endContent={
            <div className="pointer-events-none flex items-center">
              <span className="text-default-400 text-small">ms</span>
            </div>
          }
          className="w-32"
          onChange={e => {
            setConfig({ ...config, downloadInterval: +e.target.value });
          }}
        />
      ),
    },
    fileNameRule: {
      label: 'File name rule',
      content: (
        <RadioGroup
          orientation="horizontal"
          value={config.fileNameRule}
          onValueChange={val =>
            setConfig({
              ...config,
              fileNameRule: val,
            })
          }>
          <Radio value="[index]">{'[Index]'}</Radio>
          <Radio value="[name]">{'[Name]'}</Radio>
          <Radio value="[index]_[total]">{'[Index]_[Total]'}</Radio>
        </RadioGroup>
      ),
    },
  };

  return (
    <div className="relative flex flex-col items-center gap-4">
      {/* table */}
      <div className="bg-content1 flex flex-col gap-4 rounded-lg p-4">
        {Object.keys(formItemMap).map(key => (
          <Row key={key} label={formItemMap[key].label} content={formItemMap[key].content} />
        ))}
      </div>
      <Button color="primary" variant="flat" className="bg-primary-700/40" onPress={saveOptions}>
        Save
      </Button>
    </div>
  );
};
