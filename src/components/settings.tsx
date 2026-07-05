import { type FC, type ReactNode } from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import { cva } from 'class-variance-authority';

import {
  type Config,
  type ImageFormat,
  type OutputMode,
  PATTERN_INVALID_FILE_PATH_CHAR,
} from '@/utils';
import { t } from '@/utils/i18n';

import { EhButton } from './eh-button';
import { CheckControl, RadioCards } from './ui-primitives';

type SettingsVariant = 'modal' | 'overlay' | 'page';

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

const settingsRowClass = cva(
  'grid grid-cols-[168px_minmax(0,1fr)] items-start gap-4 rounded-eh-sm transition-colors',
  {
    variants: {
      variant: {
        modal: 'px-2.5 py-2.5 hover:bg-[var(--eh-hover-bg)]',
        overlay: 'px-3 py-3 hover:bg-[var(--eh-hover-bg)]',
        page: 'px-3 py-3 hover:bg-[var(--eh-hover-bg)]',
      },
    },
  }
);

const settingsLabelClass = cva('min-w-0 select-none pt-1 text-[13px] font-normal leading-5 text-ink', {
  variants: {
    variant: {
      modal: '',
      overlay: '',
      page: 'text-sm',
    },
  },
});

const settingsFieldClass = cva('min-w-0 text-body', {
  variants: {
    variant: {
      modal: 'text-xs leading-5',
      overlay: 'text-[13px] leading-5',
      page: 'text-sm',
    },
  },
});

const settingsTextInputClass = cva(
  'flex-1 rounded-eh-sm border border-hairline bg-transparent px-2.5 py-1.5 text-ink outline-none transition-colors placeholder:text-muted-soft focus:border-brand-primary-active',
  {
    variants: {
      variant: {
        modal: 'text-xs',
        overlay: 'w-full max-w-[420px] text-[13px]',
        page: 'w-full max-w-[420px] py-2 text-sm',
      },
    },
  }
);

const settingsPanelClass = cva('flex flex-col', {
  variants: {
    variant: {
      modal: 'gap-5 rounded-eh-lg border border-hairline p-3.5',
      overlay: 'mx-auto w-full max-w-[680px] gap-2.5',
      page: 'gap-4 rounded-eh-lg border border-hairline p-6',
    },
  },
});

const settingsGroupClass = cva(
  'flex flex-col rounded-eh-sm border border-hairline bg-transparent',
  {
    variants: {
      variant: {
        overlay: 'gap-2.5 px-4 py-3.5',
        page: 'gap-3 px-4 py-4',
      },
    },
  }
);

const settingsGroupRowsClass = cva(
  'flex flex-col border-t border-[var(--eh-hairline-soft)] pt-2.5',
  {
    variants: {
      variant: {
        overlay: 'gap-1',
        page: 'gap-1.5',
      },
    },
  }
);

const Row = ({
  label,
  content,
  variant,
}: Record<'label' | 'content', ReactNode> & { variant: SettingsVariant }) => (
  <div className={settingsRowClass({ variant })}>
    <div className={settingsLabelClass({ variant })}>{label}</div>
    <div className={settingsFieldClass({ variant })}>{content}</div>
  </div>
);

const TextInput = ({
  className,
  variant,
  id,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { variant: SettingsVariant }) => (
  <input type="text" id={id} className={settingsTextInputClass({ variant, className })} {...rest} />
);

const HintLabel = ({ label, hint }: { label: string; hint: string }) => (
  <Tooltip.Root>
    <Tooltip.Trigger
      type="button"
      delay={180}
      closeDelay={80}
      className="inline-flex max-w-full cursor-help items-center border-0 border-b border-dotted border-muted-soft/80 bg-transparent p-0 text-left text-[inherit] outline-none transition-colors hover:border-ink hover:text-ink focus-visible:border-brand-primary-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--eh-action-blue))]"
    >
      {label}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner side="top" align="start" sideOffset={8} className="z-[70]">
        <Tooltip.Popup className="eh-tooltip__popup relative z-50 max-w-[260px] rounded-eh-sm border border-hairline bg-brand-primary px-2.5 py-2 text-xs leading-relaxed text-primary-foreground shadow-card-elevated">
          <Tooltip.Arrow className="eh-tooltip__arrow relative block h-1.5 w-3 overflow-hidden" />
          {hint}
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
);

export const Settings: FC<{
  config: Config;
  setConfig: (config: Config) => void;
  variant?: SettingsVariant;
  pathPreview?: string;
}> = ({ config, setConfig, variant = 'modal', pathPreview }) => {
  type ConfigKey = keyof Config;

  const formItemMap: Record<keyof Config, { label: ReactNode; content: ReactNode }> = {
    intermediateDownloadPath: {
      label: <HintLabel label={t('downloadFolder')} hint={t('downloadFolderHint')} />,
      content: (
        <div className="flex flex-wrap items-center gap-2">
          <EhButton
            variant="secondary"
            ehSize="sm"
            className={`rounded-full px-2.5 font-normal text-primary-400 [height:28px] [min-height:28px] [min-width:0] hover:text-ink ${
              variant === 'page' ? 'text-[13px]' : 'text-xs'
            }`}
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
          onChange={(val) =>
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
            className={settingsTextInputClass({
              variant,
              className: 'eh-number-input w-full pr-8 font-mono tabular-nums',
            })}
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
    <div className={settingsPanelClass({ variant })}>
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
            <section key={group.title} className={settingsGroupClass({ variant })}>
              <h2 className="select-none text-xs font-medium tracking-normal text-ink">
                {group.title}
              </h2>
              <div className={settingsGroupRowsClass({ variant })}>{group.keys.map(renderRow)}</div>
            </section>
          ))
        : (Object.keys(formItemMap) as ConfigKey[]).map(renderRow)}
    </div>
  );
};
