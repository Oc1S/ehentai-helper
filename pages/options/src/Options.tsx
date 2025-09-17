import React, { FC, ReactNode, useState } from 'react';
import {
  Config,
  defaultConfig,
  PATTERN_INVALID_FILE_PATH_CHAR,
  useMounted,
  withErrorBoundary,
  withSuspense,
} from '@ehentai-helper/shared';
import { Button, Checkbox, Input, Radio, RadioGroup, Tooltip } from '@nextui-org/react';

import { Toast } from './components';

const STATUS_SHOWING_DURATION = 3_000;

const showDefaultDownloadFolder = () => {
  chrome.downloads.showDefaultFolder();
};

const processFilePath = (path: string) => {
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

const Options: FC = () => {
  const [toastInfo, setToastInfo] = useState('');

  const [config, setConfig] = useState<Config>(defaultConfig);

  const restoreOptions = () => {
    chrome.storage.sync.get(defaultConfig, items => {
      setConfig(items as typeof config);
    });
  };

  const showToast = (text: string, duration: number) => {
    setToastInfo(text);
    setTimeout(() => setToastInfo(''), duration);
  };

  const saveOptions = () => {
    const intermediateDownloadPath = processFilePath(config.intermediateDownloadPath);

    if (!intermediateDownloadPath) {
      // process file path.
      setToastInfo(
        'Failed to save options. ' + 'File path should not contain the following characters ' + ': * ? " < > |'
      );
      return;
    }
    if (intermediateDownloadPath !== config.intermediateDownloadPath) {
      setConfig({ ...config, intermediateDownloadPath });
    }
    chrome.storage.sync.set(config, () => showToast('Saved', STATUS_SHOWING_DURATION));
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
          <div className="underline" onClick={showDefaultDownloadFolder}>
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
      <Toast visible={!!toastInfo}>{toastInfo}</Toast>
      {/* table */}
      <div className="bg-content1 flex flex-col gap-4 rounded-lg p-4">
        {Object.keys(formItemMap).map(key => (
          <Row key={key} label={formItemMap[key].label} content={formItemMap[key].content} />
        ))}
      </div>
      <Button color="primary" className="text-black" onPress={saveOptions}>
        Save
      </Button>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <div> Loading ... </div>), <div> Something went wrong </div>);
