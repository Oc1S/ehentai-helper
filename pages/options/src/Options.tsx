import { FC, useState } from 'react';
import {
  withErrorBoundary,
  withSuspense,
  useMounted,
  PATTERN_INVALID_FILE_PATH_CHAR,
  defaultConfig,
} from '@chrome-extension-boilerplate/shared';
import { Button, Checkbox, Radio, RadioGroup, Input } from '@nextui-org/react';
import { Toast } from './components';

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
      <div className="w-[200px]">{label}</div>
      <div className="w-[600px]">{content}</div>
    </div>
  );
};

const TextInput = ({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input type="text" className={`border-b border-primary bg-transparent text-primary ${className}`} {...rest} />
);

const Options: FC = () => {
  const [status, setStatus] = useState('');

  const [form, setForm] = useState(defaultConfig);

  const restoreOptions = () => {
    chrome.storage.sync.get(defaultConfig, items => {
      setForm(items as typeof form);
    });
  };

  const showEphemeralStatus = (text: string, duration: number) => {
    setStatus(text);
    setTimeout(() => setStatus(''), duration);
  };

  const saveOptions = () => {
    const intermediateDownloadPath = processFilePath(form.intermediateDownloadPath);

    if (!intermediateDownloadPath) {
      // process file path.
      setStatus(
        'Failed to save options. ' + 'File path should not contain the following characters ' + ': * ? " < > |'
      );
      return;
    }
    if (intermediateDownloadPath !== form.intermediateDownloadPath) {
      setForm({ ...form, intermediateDownloadPath });
    }
    chrome.storage.sync.set(form, () => showEphemeralStatus('Options saved.', STATUS_SHOWING_DURATION));
  };

  useMounted(() => {
    restoreOptions();
  });

  return (
    <div className="relative flex flex-col gap-4 items-center">
      <Toast visible={!!status}>{status}</Toast>
      {/* table */}
      <div className="flex flex-col bg-content1 rounded-lg p-4 gap-4">
        <Row
          label={
            <span title="For security reasons, you can only set a directory inside the default download folder.">
              Download folder
            </span>
          }
          content={
            <div className="flex items-baseline">
              <div className="underline" onClick={showDefaultDownloadFolder}>
                [Default download folder]/
              </div>
              <TextInput />
            </div>
          }
        />

        <Row
          label="Save original images"
          content={
            <Checkbox
              isSelected={form.saveOriginalImages}
              onChange={e => {
                setForm({ ...form, saveOriginalImages: e.target.checked });
              }}
            />
          }
        />

        <Row
          label="Save gallery information"
          content={
            <div className="flex gap-4">
              <Checkbox
                isSelected={form.saveGalleryInfo}
                onChange={e => {
                  setForm({ ...form, saveGalleryInfo: e.target.checked });
                }}>
                Info
              </Checkbox>
              <Checkbox
                isSelected={form.saveGalleryTags}
                onChange={e => {
                  setForm({ ...form, saveGalleryTags: e.target.checked });
                }}>
                Tags
              </Checkbox>
            </div>
          }
        />

        <Row
          label="filenameConflictAction"
          content={
            <RadioGroup
              orientation="horizontal"
              value={form.filenameConflictAction}
              onValueChange={val =>
                setForm({
                  ...form,
                  filenameConflictAction: val,
                })
              }>
              <Radio value="uniquify">Uniquify</Radio>
              <Radio value="overwrite">Overwrite</Radio>
            </RadioGroup>
          }
        />

        <Row
          label={
            <span title="The interval between each image download. This is to avoid blocking due to high QPS.">
              Download interval
            </span>
          }
          content={
            <Input
              type="number"
              placeholder="300"
              value={String(form.downloadInterval)}
              endContent={
                <div className="pointer-events-none flex items-center">
                  <span className="text-default-400 text-small">ms</span>
                </div>
              }
              className="w-32"
              onChange={e => {
                setForm({ ...form, downloadInterval: +e.target.value });
              }}
            />
          }
        />
      </div>
      <Button color="primary" className="text-black" onClick={saveOptions}>
        Save
      </Button>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <div> Loading ... </div>), <div> Something went wrong </div>);
