import { type FC, type ReactNode } from 'react';
import { Checkbox, Input, Radio, RadioGroup, Tooltip } from '@nextui-org/react';

import { type Config, PATTERN_INVALID_FILE_PATH_CHAR } from '@/shared';

export const validateFilePath = (path: string) => {
  if (PATTERN_INVALID_FILE_PATH_CHAR.test(path)) {
    return null;
  }
  path = path.replace(/\\/g, '/');
  if (path[path.length - 1] !== '/') {
    path += '/';
  }
  return path;
};

const Row = ({
  label,
  content,
  variant,
}: Record<'label' | 'content', ReactNode> & { variant: 'modal' | 'page' }) => (
  <div className={variant === 'page' ? 'settings-row settings-row--page' : 'settings-row'}>
    <div className={variant === 'page' ? 'settings-label settings-label--page' : 'settings-label'}>
      {label}
    </div>
    <div
      className={
        variant === 'page' ? 'settings-content settings-content--page' : 'settings-content'
      }
    >
      {content}
    </div>
  </div>
);

const TextInput = ({
  className,
  variant,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { variant: 'modal' | 'page' }) => (
  <input
    type="text"
    className={`path-input ${variant === 'page' ? 'path-input--page' : ''} ${className ?? ''}`.trim()}
    {...rest}
  />
);

export const Settings: FC<{
  config: Config;
  setConfig: (config: Config) => void;
  variant?: 'modal' | 'page';
}> = ({ config, setConfig, variant = 'modal' }) => {
  const formItemMap: Record<keyof Config, { label: ReactNode; content: ReactNode }> = {
    intermediateDownloadPath: {
      label: (
        <span title="For security reasons, you can only set a directory inside the default download folder.">
          Download folder
        </span>
      ),
      content: (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="text-link shrink-0"
            onClick={() => {
              chrome.downloads.showDefaultFolder();
            }}
          >
            [Default]/
          </button>
          <TextInput
            variant={variant}
            value={config.intermediateDownloadPath}
            onChange={(e) => setConfig({ ...config, intermediateDownloadPath: e.target.value })}
          />
        </div>
      ),
    },
    saveOriginalImages: {
      label: 'Save original images',
      content: (
        <Checkbox
          isSelected={config.saveOriginalImages}
          onChange={(e) => {
            setConfig({ ...config, saveOriginalImages: e.target.checked });
          }}
        />
      ),
    },
    saveGalleryInfo: {
      label: 'Save gallery information',
      content: (
        <Checkbox
          isSelected={config.saveGalleryInfo}
          onChange={(e) => {
            setConfig({ ...config, saveGalleryInfo: e.target.checked });
          }}
        />
      ),
    },
    filenameConflictAction: {
      label: <Tooltip closeDelay={200}>Filename conflict Action</Tooltip>,
      content: (
        <RadioGroup
          orientation="horizontal"
          value={config.filenameConflictAction}
          onValueChange={(val: chrome.downloads.FilenameConflictAction) =>
            setConfig({
              ...config,
              filenameConflictAction: val,
            })
          }
        >
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
          endContent={<span className="caption-soft">ms</span>}
          className="w-32"
          size={variant === 'page' ? 'sm' : 'md'}
          onChange={(e) => {
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
          onValueChange={(val) =>
            setConfig({
              ...config,
              fileNameRule: val,
            })
          }
        >
          <Radio value="[index]">{'[Index]'}</Radio>
          <Radio value="[name]">{'[Name]'}</Radio>
          <Radio value="[index]_[total]">{'[Index]_[Total]'}</Radio>
        </RadioGroup>
      ),
    },
  };

  const panelClass =
    variant === 'page'
      ? 'settings-panel settings-panel--page'
      : 'settings-panel settings-panel--modal';

  return (
    <div className={panelClass}>
      {Object.keys(formItemMap).map((key) => (
        <Row
          key={key}
          variant={variant}
          label={formItemMap[key as keyof Config].label}
          content={formItemMap[key as keyof Config].content}
        />
      ))}
    </div>
  );
};
