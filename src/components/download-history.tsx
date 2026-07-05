import type { FC } from 'react';
import { useMemo, useState } from 'react';

import { useStorageSuspense } from '@/hooks';
import {
  type DownloadHistoryItem,
  downloadHistoryStorage,
  type GalleryRecord,
  galleryRecordsStorage,
  getDownloadHistoryRanges,
  MAX_DOWNLOAD_HISTORY,
  MAX_GALLERY_RECORDS,
  mergeDownloadHistoryItems,
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

const countRangeTotal = (ranges: [number, number][]) =>
  ranges.reduce((total, [start, end]) => total + end - start + 1, 0);

const formatRange = (item: DownloadHistoryItem) => {
  const ranges = getDownloadHistoryRanges(item);
  if (ranges.length <= 2) return ranges.map(([start, end]) => `${start}-${end}`).join(', ');
  const [firstStart, firstEnd] = ranges[0];
  return `${firstStart}-${firstEnd}, +${ranges.length - 1}`;
};

const formatStatus = (record: GalleryRecord | undefined, item: DownloadHistoryItem) => {
  if (!record) return t('statusUnknown');
  const ranges = getDownloadHistoryRanges(item);
  let complete = 0;
  for (const [start, end] of ranges) {
    for (let i = start; i <= end; i++) {
      if (record.images[String(i)]?.state === 'complete') complete++;
    }
  }
  return t('statusCompleteRatio', [String(complete), String(countRangeTotal(ranges))]);
};

export const History: FC = () => {
  const list = useStorageSuspense(downloadHistoryStorage) || [];
  const galleryRecords = useStorageSuspense(galleryRecordsStorage) || {};
  const data = useMemo<DownloadHistoryItem[]>(() => {
    return mergeDownloadHistoryItems(list);
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
                  <td className="min-w-0 max-w-0 overflow-hidden">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[rgb(var(--eh-action-blue))] underline underline-offset-2 [overflow-wrap:normal] [word-break:normal]"
                      title={item.name}
                    >
                      {item.name}
                    </a>
                  </td>
                  <td className="whitespace-nowrap text-xs text-muted">
                    {formatStatus(galleryRecords[item.url], item)}
                  </td>
                  <td className="whitespace-nowrap text-muted-soft" title={formatRange(item)}>
                    {formatRange(item)}
                  </td>
                  <td className="whitespace-nowrap text-muted-soft">
                    {formatTime(item.timestamp)}
                  </td>
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
        presentation="dialog"
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
        presentation="dialog"
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
                  downloadHistoryStorage.remove(deleteTarget.url);
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
