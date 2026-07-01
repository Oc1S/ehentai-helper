import type { ComponentProps, FC } from 'react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { retryFailedDownload } from '@/download/client';
import { useStorage, useStorageSuspense } from '@/hooks';
import {
  downloadIndexMapStorage,
  downloadListStorage,
  downloadTaskStorage,
  galleryRecordsStorage,
} from '@/storage';
import { t } from '@/utils/i18n';

import { EhButton } from './eh-button';
import { EhTableFrame } from './eh-table';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import {
  CheckControl,
  PaginationControls,
  type PillTone,
  StatusPill,
  TextField,
} from './ui-primitives';

const pageSize = 6;

type DownloadItem = chrome.downloads.DownloadItem & { displayIndex?: number };
type DownloadState = DownloadItem['state'];

const CellButton = ({ children, ...rest }: ComponentProps<typeof EhButton>) => (
  <EhButton variant="primary" ehSize="sm" {...rest}>
    {children}
  </EhButton>
);

const columns = () => [
  { key: 'displayIndex', label: t('colIndex'), width: 48 },
  { key: 'state', label: t('colState'), width: 100 },
  { key: 'filename', label: t('colFile'), width: 280 },
  { key: 'operation', label: t('colAction'), width: 140 },
];

const stateMap: Record<DownloadState, ReactNode> = {
  in_progress: <>{t('stateDownloading')}</>,
  interrupted: <>{t('stateInterrupted')}</>,
  complete: <>{t('stateComplete')}</>,
};

const statusColorMap: Record<DownloadState, PillTone> = {
  complete: 'success',
  in_progress: 'warning',
  interrupted: 'danger',
};

export const DownloadTable: FC<{ taskId?: string | null }> = ({ taskId }) => {
  const list = useStorageSuspense(downloadListStorage) || [];
  const indexMap = useStorageSuspense(downloadIndexMapStorage) || {};
  const activeTask = useStorage(downloadTaskStorage);
  const galleryRecords = useStorageSuspense(galleryRecordsStorage) || {};
  const filterTaskId = taskId ?? activeTask?.taskId ?? null;

  const [downloadList, setDownloadList] = useState(list);
  const [page, setPage] = useState(1);
  const [filterValue, setFilterValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<DownloadState>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    setDownloadList(list);
  }, [list]);

  const stateSelections: { label: string; id: DownloadItem['state'] }[] = [
    { id: 'complete', label: t('stateComplete') },
    { id: 'in_progress', label: t('stateInProgress') },
    { id: 'interrupted', label: t('stateInterrupted') },
  ];

  const filteredList = useMemo(() => {
    let next = downloadList.map((item) => {
      const entry = indexMap[String(item.id)];
      const localPathArr = item.filename.replace(/\\/g, '/').split('/');
      const filename =
        localPathArr[localPathArr.length - 1] ?? localPathArr[localPathArr.length - 2];
      return {
        ...item,
        filename,
        displayIndex: entry?.index,
      } as DownloadItem;
    });

    if (filterTaskId) {
      next = next.filter((item) => indexMap[String(item.id)]?.taskId === filterTaskId);
    }

    next = filterValue ? next.filter((item) => item.filename.includes(filterValue)) : next;
    next = statusFilter.size === 0 ? next : next.filter((item) => statusFilter.has(item.state));
    return next;
  }, [downloadList, filterValue, statusFilter, indexMap, filterTaskId]);

  const toggleStatus = (state: DownloadState, checked: boolean) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (checked) next.add(state);
      else next.delete(state);
      return next;
    });
    setPage(1);
  };

  const retryViaOrchestrator = async (entry: (typeof indexMap)[string]) => {
    const record = entry.galleryUrl ? galleryRecords[entry.galleryUrl] : undefined;
    if (!entry.galleryUrl || !record) {
      toast.error(t('missingGalleryContext'));
      return;
    }
    const imagesPerPage = 20;
    const numPages = Math.ceil(record.total / imagesPerPage);
    const res = await retryFailedDownload({
      galleryFrontPageUrl: entry.galleryUrl,
      galleryName: record.galleryName,
      galleryId: record.galleryId,
      downloadPath: entry.downloadPath ?? record.downloadPath,
      rangeStart: entry.index,
      rangeEnd: entry.index,
      imagesPerPage,
      numPages,
      totalImages: record.total,
      indices: [entry.index],
    });
    if (res?.ok) toast.success(t('retryStarted'));
    else toast.error(t('retryFailedToast'));
  };

  const renderCell = (item: DownloadItem, key: string) => {
    const { state, id } = item;
    const entry = indexMap[String(id)];

    const RestartButton = (
      <CellButton
        onClick={() => {
          if (entry) void retryViaOrchestrator(entry);
        }}
      >
        {t('retry')}
      </CellButton>
    );

    const operationMap = {
      interrupted: () => RestartButton,
      in_progress: () => RestartButton,
      complete: () => null,
    };

    switch (key) {
      case 'displayIndex':
        return <span className="font-mono text-xs text-muted">{item.displayIndex ?? '-'}</span>;
      case 'state':
        return (
          <StatusPill tone={statusColorMap[item.state]} className="capitalize">
            {stateMap[item.state]}
          </StatusPill>
        );
      case 'filename':
        return <span className="line-clamp-1">{item.filename}</span>;
      case 'operation':
        return operationMap[state]();
      default:
        return item[key as keyof DownloadItem] as React.ReactNode;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <TextField
          className="max-w-[320px] flex-1"
          placeholder={t('searchFilename')}
          isClearable
          value={filterValue}
          onValueChange={(value) => {
            setPage(1);
            setFilterValue(value);
          }}
        />
        <div className="relative">
          <EhButton
            variant="secondary"
            ehSize="sm"
            endContent={<ChevronDownIcon className="text-small" />}
            onPress={() => setFilterOpen((prev) => !prev)}
          >
            {t('filter')}
          </EhButton>
          {filterOpen ? (
            <div className="absolute left-0 top-11 z-20 w-44 rounded-eh-sm border border-hairline bg-white p-2 shadow-card-elevated">
              <div className="flex flex-col gap-2">
                {stateSelections.map((state) => (
                  <CheckControl
                    key={state.id}
                    checked={statusFilter.has(state.id)}
                    onCheckedChange={(checked) => toggleStatus(state.id, checked)}
                    label={<span className="capitalize">{state.label}</span>}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <span className="text-xs text-muted">{t('itemsCount', String(filteredList.length))}</span>
      </div>
      <EhTableFrame>
        <table className="eh-data-table" aria-label="downloads">
          <thead>
            <tr>
              {columns().map((col) => (
                <th key={col.key} style={{ width: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={columns().length} className="py-10 text-center text-muted-soft">
                  {t('noRecords')}
                </td>
              </tr>
            ) : (
              filteredList.slice((page - 1) * pageSize, page * pageSize).map((item) => (
                <tr key={item.id}>
                  {columns().map((col) => (
                    <td key={col.key}>{renderCell(item, col.key)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </EhTableFrame>
      <div className="flex shrink-0 items-center justify-center pt-1">
        <PaginationControls
          total={Math.max(1, Math.ceil(filteredList.length / pageSize))}
          page={page}
          onChange={setPage}
        />
      </div>
    </div>
  );
};
