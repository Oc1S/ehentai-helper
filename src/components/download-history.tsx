import type { FC } from 'react';
import { useMemo, useState } from 'react';

import { useStorageSuspense } from '@/hooks';
import {
  type DownloadHistoryItem,
  downloadHistoryStorage,
  type GalleryRecord,
  galleryRecordsStorage,
  MAX_DOWNLOAD_HISTORY,
  MAX_GALLERY_RECORDS,
} from '@/storage';
import { t } from '@/utils/i18n';

import { EhButton } from './eh-button';
import { EhTableFrame } from './eh-table';
import { GalleryDetailModal } from './gallery-detail-modal';
import { Modal, TextField } from './ui-primitives';

const columns = () => [
  { key: 'name', label: t('colName') },
  { key: 'status', label: t('colStatus') },
  { key: 'range', label: t('colRange') },
  { key: 'time', label: t('colTime') },
  { key: 'op', label: t('colOp') },
];

const formatTime = (ts: number) => new Date(ts).toLocaleString();

const formatStatus = (record: GalleryRecord | undefined, range: [number, number]) => {
  if (!record) return t('statusUnknown');
  let complete = 0;
  for (let i = range[0]; i <= range[1]; i++) {
    if (record.images[String(i)]?.state === 'complete') complete++;
  }
  const total = range[1] - range[0] + 1;
  return t('statusCompleteRatio', [String(complete), String(total)]);
};

export const History: FC = () => {
  const list = useStorageSuspense(downloadHistoryStorage) || [];
  const galleryRecords = useStorageSuspense(galleryRecordsStorage) || {};
  const data = useMemo<DownloadHistoryItem[]>(() => {
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }, [list]);
  const [keyword, setKeyword] = useState('');
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DownloadHistoryItem | null>(null);

  const filteredData = useMemo<DownloadHistoryItem[]>(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return data;
    return data.filter((item) => item.name.toLowerCase().includes(kw));
  }, [data, keyword]);

  const activeRecord = activeUrl ? galleryRecords[activeUrl] ?? null : null;

  const galleryCount = Object.keys(galleryRecords).length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <p className="shrink-0 text-xs leading-relaxed text-muted-soft">
        {t('storageLimitHint', [
          String(data.length),
          String(MAX_DOWNLOAD_HISTORY),
          String(galleryCount),
          String(MAX_GALLERY_RECORDS),
        ])}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <TextField
          placeholder={t('searchByName')}
          value={keyword}
          onValueChange={setKeyword}
          isClearable
          className="max-w-[280px] flex-1"
        />
        <span className="text-xs text-muted">
          {t('recordsCount', [String(filteredData.length), String(data.length)])}
        </span>
        <div className="flex-1" />
        <EhButton variant="danger" ehSize="sm" onPress={() => setConfirmClear(true)}>
          {t('clearAll')}
        </EhButton>
      </div>
      <EhTableFrame>
        <table className="eh-data-table" aria-label="download history">
          <thead>
            <tr>
              {columns().map((col) => (
                <th
                  key={col.key}
                  style={{
                    width:
                      col.key === 'name'
                        ? 220
                        : col.key === 'status'
                          ? 108
                          : col.key === 'time'
                            ? 128
                            : col.key === 'op'
                              ? 148
                              : 64,
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns().length} className="py-10 text-center text-muted-soft">
                  {t('noHistory')}
                </td>
              </tr>
            ) : (
              filteredData.map((item) => (
                <tr key={item.timestamp}>
                  <td className="eh-table-cell--clip">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="eh-url-link text-xs text-[var(--eh-action-blue-hex)] underline underline-offset-2"
                      title={item.name}
                    >
                      {item.name}
                    </a>
                  </td>
                  <td className="whitespace-nowrap text-xs text-muted">
                    {formatStatus(galleryRecords[item.url], item.range)}
                  </td>
                  <td className="whitespace-nowrap text-muted-soft">
                    {item.range[0]}-{item.range[1]}
                  </td>
                  <td className="whitespace-nowrap text-muted-soft">{formatTime(item.timestamp)}</td>
                  <td className="py-1.5">
                    <div className="flex flex-nowrap items-center gap-1">
                      <EhButton
                        variant="secondary"
                        ehSize="sm"
                        disabled={!galleryRecords[item.url]}
                        onPress={() => setActiveUrl(item.url)}
                      >
                        {t('detail')}
                      </EhButton>
                      <EhButton variant="danger" ehSize="sm" onPress={() => setDeleteTarget(item)}>
                        {t('delete')}
                      </EhButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </EhTableFrame>
      <GalleryDetailModal
        isOpen={activeUrl !== null}
        onClose={() => setActiveUrl(null)}
        record={activeRecord}
      />
      <Modal
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        size="sm"
        title={<h2 className="text-base font-medium text-ink">{t('clearAll')}</h2>}
        footer={
          <>
            <EhButton variant="secondary" ehSize="sm" onPress={() => setConfirmClear(false)}>
              {t('cancel')}
            </EhButton>
            <EhButton
              variant="danger"
              ehSize="sm"
              onPress={() => {
                downloadHistoryStorage.clear();
                galleryRecordsStorage.clear();
                setConfirmClear(false);
              }}
            >
              {t('clearAll')}
            </EhButton>
          </>
        }
      >
        <p className="text-sm text-muted">{t('confirmClearAll')}</p>
      </Modal>
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        title={<h2 className="text-base font-medium text-ink">{t('delete')}</h2>}
        footer={
          <>
            <EhButton variant="secondary" ehSize="sm" onPress={() => setDeleteTarget(null)}>
              {t('cancel')}
            </EhButton>
            <EhButton
              variant="danger"
              ehSize="sm"
              onPress={() => {
                if (deleteTarget) {
                  downloadHistoryStorage.remove(deleteTarget.timestamp);
                  galleryRecordsStorage.removeGallery(deleteTarget.url);
                }
                setDeleteTarget(null);
              }}
            >
              {t('delete')}
            </EhButton>
          </>
        }
      >
        <p className="text-sm text-muted">{t('confirmDelete')}</p>
      </Modal>
    </div>
  );
};
