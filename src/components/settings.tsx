import { type FC, type ReactNode } from 'react';
import { Checkbox, Input, Radio, RadioGroup, Tooltip } from '@nextui-org/react';

import {
  type Config,
  type ImageFormat,
  type OutputMode,
  PATTERN_INVALID_FILE_PATH_CHAR,
} from '@/utils';
import { t } from '@/utils/i18n';
export const validateFilePath = (path: string) => {
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

const Row = ({
  label,
  content,
  variant,
}: Record<'label' | 'content', ReactNode> & { variant: 'modal' | 'page' }) => (
  <div
    className={
      variant === 'page' ? 'settings-row settings-row--page' : 'settings-row settings-row--modal'
    }
  >
    <div
      className={
        variant === 'page'
          ? 'settings-label settings-label--page'
          : variant === 'modal'
            ? 'settings-label--modal'
            : 'settings-label'
      }
    >
      {label}
    </div>
    <div
      className={
        variant === 'page'
          ? 'settings-content settings-content--page'
          : variant === 'modal'
            ? 'settings-content--modal'
            : 'settings-content'
      }
    >
      {content}
    </div>
  </div>
);

const TextInput = ({
  className,
  variant,
  id,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { variant: 'modal' | 'page' }) => (
  <input
    type="text"
    id={id}
    className={[
      'eh-text-input',
      variant === 'page' ? 'eh-text-input--page path-input--page text-sm' : 'eh-text-input--modal text-[12px]',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...rest}
  />
);

const HintLabel = ({ label, hint }: { label: string; hint: string }) => (
  <Tooltip content={hint} closeDelay={200} placement="top-start">
    <span className="cursor-help border-b border-dotted border-muted-soft/80">{label}</span>
  </Tooltip>
);

export const Settings: FC<{
  config: Config;
  setConfig: (config: Config) => void;
  variant?: 'modal' | 'page';
  pathPreview?: string;
}> = ({ config, setConfig, variant = 'modal', pathPreview }) => {
  const formItemMap: Record<keyof Config, { label: ReactNode; content: ReactNode }> = {
    intermediateDownloadPath: {
      label: <HintLabel label={t('downloadFolder')} hint={t('downloadFolderHint')} />,
      content: (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`shrink-0 font-normal text-ink underline underline-offset-2 ${variant === 'page' ? 'text-[13px]' : 'text-[12px]'}`}
            onClick={() => {
              chrome.downloads.showDefaultFolder();
            }}
          >
            {t('defaultFolder')}
          </button>
          <TextInput
            id="eh-download-path"
            variant={variant}
            aria-label={t('downloadFolder')}
            value={config.intermediateDownloadPath}
            onChange={(e) => setConfig({ ...config, intermediateDownloadPath: e.target.value })}
          />
        </div>
      ),
    },
    saveOriginalImages: {
      label: t('saveOriginalImages'),
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
      label: t('saveGalleryInfo'),
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
      label: <HintLabel label={t('filenameConflictAction')} hint={t('filenameConflictHint')} />,
      content: (
        <RadioGroup
          orientation="horizontal"
          size={variant === 'modal' ? 'sm' : 'md'}
          value={config.filenameConflictAction}
          onValueChange={(val: chrome.downloads.FilenameConflictAction) =>
            setConfig({
              ...config,
              filenameConflictAction: val,
            })
          }
        >
          <Radio value="uniquify">{t('uniquify')}</Radio>
          <Radio value="overwrite">{t('overwrite')}</Radio>
        </RadioGroup>
      ),
    },
    downloadInterval: {
      label: <HintLabel label={t('downloadInterval')} hint={t('downloadIntervalHint')} />,
      content: (
        <Input
          type="number"
          placeholder="300"
          value={String(config.downloadInterval)}
          endContent={<span className="text-xs text-muted-soft">ms</span>}
          className="w-28"
          size="sm"
          classNames={
            variant === 'modal'
              ? {
                  input: 'text-[12px]',
                  inputWrapper:
                    'h-8 min-h-8 border border-[var(--eh-glass-border)] bg-[rgb(8_8_9/0.28)] shadow-none backdrop-blur-sm data-[hover=true]:bg-[rgb(10_10_11/0.35)] group-data-[focus=true]:border-brand-accent/35',
                }
              : undefined
          }
          onChange={(e) => {
            const val = +e.target.value;
            if (Number.isNaN(val) || val < 0) return;
            setConfig({ ...config, downloadInterval: val });
          }}
        />
      ),
    },
    fileNameRule: {
      label: t('fileNameRule'),
      content: (
        <RadioGroup
          orientation="horizontal"
          size={variant === 'modal' ? 'sm' : 'md'}
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
      label: <HintLabel label={t('imageFormat')} hint={t('imageFormatHint')} />,
      content: (
        <RadioGroup
          orientation="horizontal"
          size={variant === 'modal' ? 'sm' : 'md'}
          value={config.imageFormat}
          onValueChange={(val) =>
            setConfig({
              ...config,
              imageFormat: val as ImageFormat,
            })
          }
        >
          <Radio value="original">{t('formatOriginal')}</Radio>
          <Radio value="jpg">JPG</Radio>
          <Radio value="png">PNG</Radio>
          <Radio value="webp">WebP</Radio>
        </RadioGroup>
      ),
    },
    outputMode: {
      label: <HintLabel label={t('output')} hint={t('outputHint')} />,
      content: (
        <RadioGroup
          orientation="horizontal"
          size={variant === 'modal' ? 'sm' : 'md'}
          value={config.outputMode ?? 'files'}
          onValueChange={(val) =>
            setConfig({
              ...config,
              outputMode: val as OutputMode,
            })
          }
        >
          <Radio value="files">{t('outputModeFiles')}</Radio>
          <Radio value="cbz">{t('outputModeCbz')}</Radio>
          <Radio value="both">{t('outputModeBoth')}</Radio>
        </RadioGroup>
      ),
    },
  };

  const panelClass =
    variant === 'page'
      ? 'flex flex-col gap-4 rounded-eh-lg border border-hairline bg-surface-card p-6 shadow-card settings-panel--page'
      : 'flex flex-col gap-5 rounded-eh-cta border border-[var(--eh-glass-border)] bg-[rgb(8_8_9/0.22)] p-3.5 backdrop-blur-sm settings-panel--modal';

  return (
    <div className={panelClass}>
      {pathPreview ? (
        <p className="text-[12px] leading-relaxed text-muted">
          {t('pathPreview')}{' '}
          <span className="font-mono text-brand-accent">
            {t('defaultFolder')}
            {pathPreview}
          </span>
        </p>
      ) : null}
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
