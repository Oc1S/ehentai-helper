import { type FC, type ReactNode } from 'react';

import {
  type Config,
  type ImageFormat,
  type OutputMode,
  PATTERN_INVALID_FILE_PATH_CHAR,
} from '@/utils';
import { t } from '@/utils/i18n';

import { EhButton } from './eh-button';
import { CheckControl, RadioCards } from './ui-primitives';

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
}: Record<'label' | 'content', ReactNode> & { variant: 'modal' | 'overlay' | 'page' }) => (
  <div
    className={
      variant === 'modal'
        ? 'eh-settings-row eh-settings-row--modal'
        : `eh-settings-row eh-settings-row--${variant}`
    }
  >
    <div
      className={
        variant === 'modal'
          ? 'eh-settings-label--modal'
          : `eh-settings-label eh-settings-label--${variant}`
      }
    >
      {label}
    </div>
    <div
      className={
        variant === 'modal'
          ? 'eh-settings-field--modal'
          : `eh-settings-field eh-settings-field--${variant}`
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
}: React.InputHTMLAttributes<HTMLInputElement> & { variant: 'modal' | 'overlay' | 'page' }) => (
  <input
    type="text"
    id={id}
    className={[
      'eh-text-input',
      variant === 'page'
        ? 'eh-text-input--page text-sm'
        : variant === 'overlay'
          ? 'eh-text-input--overlay text-[13px]'
          : 'eh-text-input--modal text-xs',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...rest}
  />
);

const HintLabel = ({ label, hint }: { label: string; hint: string }) => (
  <span className="cursor-help border-b border-dotted border-muted-soft/80" title={hint}>
    {label}
  </span>
);

export const Settings: FC<{
  config: Config;
  setConfig: (config: Config) => void;
  variant?: 'modal' | 'overlay' | 'page';
  pathPreview?: string;
}> = ({ config, setConfig, variant = 'modal', pathPreview }) => {
  type ConfigKey = keyof Config;

  const formItemMap: Record<keyof Config, { label: ReactNode; content: ReactNode }> = {
    intermediateDownloadPath: {
      label: <HintLabel label={t('downloadFolder')} hint={t('downloadFolderHint')} />,
      content: (
        <div className="flex flex-wrap items-center gap-2">
          <EhButton
            variant="link"
            ehSize="sm"
            className={`eh-default-folder-button ${variant === 'page' ? 'text-[13px]' : 'text-xs'}`}
            onPress={() => {
              chrome.downloads.showDefaultFolder();
            }}
          >
            {t('defaultFolder')}
          </EhButton>
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
        <CheckControl
          checked={config.saveOriginalImages}
          onCheckedChange={(checked) => setConfig({ ...config, saveOriginalImages: checked })}
        />
      ),
    },
    saveGalleryInfo: {
      label: t('saveGalleryInfo'),
      content: (
        <CheckControl
          checked={config.saveGalleryInfo}
          onCheckedChange={(checked) => setConfig({ ...config, saveGalleryInfo: checked })}
        />
      ),
    },
    filenameConflictAction: {
      label: <HintLabel label={t('filenameConflictAction')} hint={t('filenameConflictHint')} />,
      content: (
        <RadioCards
          value={config.filenameConflictAction}
          onChange={(val: chrome.downloads.FilenameConflictAction) =>
            setConfig({
              ...config,
              filenameConflictAction: val,
            })
          }
          items={[
            { value: 'uniquify', label: t('uniquify') },
            { value: 'overwrite', label: t('overwrite') },
          ]}
        />
      ),
    },
    downloadInterval: {
      label: <HintLabel label={t('downloadInterval')} hint={t('downloadIntervalHint')} />,
      content: (
        <div className="relative w-28">
          <input
            type="number"
            placeholder="300"
            value={String(config.downloadInterval)}
            className={`eh-text-input ${
              variant === 'page'
                ? 'eh-text-input--page'
                : variant === 'overlay'
                  ? 'eh-text-input--overlay text-[13px]'
                  : 'eh-text-input--modal text-xs'
            } pr-8`}
            onChange={(e) => {
              const val = +e.target.value;
              if (Number.isNaN(val) || val < 0) return;
              setConfig({ ...config, downloadInterval: val });
            }}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-soft">
            ms
          </span>
        </div>
      ),
    },
    fileNameRule: {
      label: t('fileNameRule'),
      content: (
        <RadioCards
          value={config.fileNameRule}
          onChange={(val) =>
            setConfig({
              ...config,
              fileNameRule: val,
            })
          }
          items={[
            { value: '[index]', label: '[Index]' },
            { value: '[name]', label: '[Name]' },
            { value: '[index]_[total]', label: '[Index]_[Total]' },
          ]}
        />
      ),
    },
    imageFormat: {
      label: <HintLabel label={t('imageFormat')} hint={t('imageFormatHint')} />,
      content: (
        <RadioCards
          value={config.imageFormat}
          onChange={(val) =>
            setConfig({
              ...config,
              imageFormat: val as ImageFormat,
            })
          }
          items={[
            { value: 'original', label: t('formatOriginal') },
            { value: 'jpg', label: 'JPG' },
            { value: 'png', label: 'PNG' },
            { value: 'webp', label: 'WebP' },
          ]}
        />
      ),
    },
    outputMode: {
      label: <HintLabel label={t('output')} hint={t('outputHint')} />,
      content: (
        <RadioCards
          value={config.outputMode ?? 'files'}
          onChange={(val) =>
            setConfig({
              ...config,
              outputMode: val as OutputMode,
            })
          }
          items={[
            { value: 'files', label: t('outputModeFiles') },
            { value: 'cbz', label: t('outputModeCbz') },
            { value: 'both', label: t('outputModeBoth') },
          ]}
        />
      ),
    },
  };

  const panelClass =
    variant === 'page'
      ? 'flex flex-col gap-4 rounded-eh-lg border border-hairline bg-surface-card p-6 eh-settings-panel--page'
      : variant === 'overlay'
        ? 'flex flex-col gap-4 eh-settings-panel--overlay'
        : 'flex flex-col gap-5 rounded-eh-lg border border-hairline bg-white p-3.5 eh-settings-panel--modal';

  const pageGroups: { title: string; keys: ConfigKey[] }[] = [
    { title: t('settingsGroupLocation'), keys: ['intermediateDownloadPath'] },
    {
      title: t('settingsGroupFileHandling'),
      keys: ['fileNameRule', 'filenameConflictAction', 'saveOriginalImages', 'saveGalleryInfo'],
    },
    { title: t('settingsGroupDownloadBehavior'), keys: ['downloadInterval'] },
    { title: t('settingsGroupOutput'), keys: ['imageFormat', 'outputMode'] },
  ];

  const renderRow = (key: ConfigKey) => (
    <Row
      key={key}
      variant={variant}
      label={formItemMap[key].label}
      content={formItemMap[key].content}
    />
  );

  return (
    <div className={panelClass}>
      {pathPreview && variant === 'page' ? (
        <p className="text-xs leading-relaxed text-muted">
          {t('pathPreview')}{' '}
          <span className="font-mono text-primary">
            {t('defaultFolder')}
            {pathPreview}
          </span>
        </p>
      ) : null}
      {variant !== 'modal'
        ? pageGroups.map((group) => (
            <section key={group.title} className="eh-settings-group">
              <h2 className="eh-settings-section-title">{group.title}</h2>
              <div className="eh-settings-group__rows">{group.keys.map(renderRow)}</div>
            </section>
          ))
        : (Object.keys(formItemMap) as ConfigKey[]).map(renderRow)}
    </div>
  );
};
