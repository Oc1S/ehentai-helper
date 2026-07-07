import type { FC } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { useStorageSuspense } from '@/hooks';
import {
  type DownloadHistoryItem,
  downloadHistoryStorage,
  type GalleryRecord,
  type GalleryRecordsMap,
  galleryRecordsStorage,
  getDownloadHistoryRanges,
  MAX_DOWNLOAD_HISTORY,
  MAX_GALLERY_RECORDS,
  mergeDownloadHistoryItems,
} from '@/storage';
import { t } from '@/utils/i18n';

import { EhButton } from './eh-button';
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

const formatRangePart = ([start, end]: [number, number]) =>
  start === end ? String(start) : `${start}-${end}`;

const formatRange = (item: DownloadHistoryItem) => {
  const ranges = getDownloadHistoryRanges(item);
  if (ranges.length <= 2) return ranges.map(formatRangePart).join(', ');
  const visibleRanges = ranges.slice(0, 2).map(formatRangePart).join(', ');
  const hiddenCount = ranges.length - 2;
  const suffix =
    hiddenCount === 1 ? t('rangeOneMoreSegment') : t('rangeMoreSegments', String(hiddenCount));
  return `${visibleRanges}, ${suffix}`;
};

const formatFullRange = (item: DownloadHistoryItem) =>
  getDownloadHistoryRanges(item).map(formatRangePart).join(', ');

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

type HistoryVirtualizer = ReturnType<typeof useVirtualizer>;

const VirtualRows = ({
  virtualizer,
  items,
  galleryRecords,
  onView,
  onDelete,
}: {
  virtualizer: HistoryVirtualizer;
  items: DownloadHistoryItem[];
  galleryRecords: GalleryRecordsMap;
  onView: (url: string) => void;
  onDelete: (item: DownloadHistoryItem) => void;
}) => {
  const virtualItems = virtualizer.getVirtualItems();
  if (virtualItems.length === 0) return null;

  const colCount = columns().length;
  const paddingTop = virtualItems[0].start;
  const paddingBottom = virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end;

  return (
    <>
      {paddingTop > 0 ? (
        <tr style={{ height: paddingTop, background: 'transparent' }} aria-hidden>
          <td colSpan={colCount} style={{ padding: 0, border: 0 }} />
        </tr>
      ) : null}
      {virtualItems.map((virtualRow) => {
        const item = items[virtualRow.index];
        if (!item) return null;
        return (
          <tr key={item.url} ref={virtualizer.measureElement} data-index={virtualRow.index}>
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
            <td className="whitespace-nowrap text-muted-soft" title={formatFullRange(item)}>
              {formatRange(item)}
            </td>
            <td className="whitespace-nowrap text-muted-soft">{formatTime(item.timestamp)}</td>
            <td className="py-1.5">
              <div className="flex flex-nowrap items-center gap-1">
                <EhButton
                  variant="secondary"
                  ehSize="sm"
                  disabled={!galleryRecords[item.url]}
                  onPress={() => onView(item.url)}
                >
                  {t('detail')}
                </EhButton>
                <EhButton variant="danger" ehSize="sm" onPress={() => onDelete(item)}>
                  {t('delete')}
                </EhButton>
              </div>
            </td>
          </tr>
        );
      })}
      {paddingBottom > 0 ? (
        <tr style={{ height: paddingBottom, background: 'transparent' }} aria-hidden>
          <td colSpan={colCount} style={{ padding: 0, border: 0 }} />
        </tr>
      ) : null}
    </>
  );
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

  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 8,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [keyword]);

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
      <div
        ref={scrollRef}
        className="scrollbar-glass min-h-0 flex-1 overflow-auto rounded-eh-sm border border-[var(--eh-hairline)] bg-transparent"
      >
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
              <VirtualRows
                virtualizer={rowVirtualizer}
                items={filteredData}
                galleryRecords={galleryRecords}
                onView={setActiveUrl}
                onDelete={setDeleteTarget}
              />
            )}
          </tbody>
        </table>
      </div>
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
