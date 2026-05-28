import { type FC, type ReactNode } from 'react';
import { Checkbox, Input, Radio, RadioGroup, Tooltip } from '@nextui-org/react';

import { type Config, type ImageFormat, PATTERN_INVALID_FILE_PATH_CHAR } from '@/shared';
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
    className={`flex-1 border-b border-hairline bg-transparent px-2 py-1 text-sm text-ink outline-none focus:border-ink ${variant === 'page' ? 'path-input--page' : ''} ${className ?? ''}`.trim()}
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
            className={`shrink-0 font-medium text-ink underline underline-offset-2 ${variant === 'page' ? 'text-[13px]' : 'text-sm'}`}
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
          endContent={<span className="text-xs text-muted-soft">ms</span>}
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
    imageFormat: {
      label: (
        <span title="Convert downloaded images to the selected format on the fly.">
          Image format
        </span>
      ),
      content: (
        <RadioGroup
          orientation="horizontal"
          value={config.imageFormat}
          onValueChange={(val) =>
            setConfig({
              ...config,
              imageFormat: val as ImageFormat,
            })
          }
        >
          <Radio value="original">Original</Radio>
          <Radio value="jpg">JPG</Radio>
          <Radio value="png">PNG</Radio>
          <Radio value="webp">WebP</Radio>
        </RadioGroup>
      ),
    },
  };

  const panelClass =
    variant === 'page'
      ? 'flex flex-col gap-4 rounded-cal-lg border border-hairline bg-surface-card p-6 shadow-card settings-panel--page'
      : 'flex flex-col gap-3 rounded-cal-lg border border-hairline bg-surface-card p-4 shadow-card';

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
