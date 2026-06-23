import type { FC } from 'react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Button,
  type ButtonProps,
  Chip,
  type ChipProps,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Pagination,
  type Selection,
  type SortDescriptor,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@nextui-org/react';
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

import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { SearchIcon } from './icons/SearchIcon';

const pageSize = 6;

type DownloadItem = chrome.downloads.DownloadItem & { displayIndex?: number };
type DownloadState = DownloadItem['state'];

const CellButton = ({ children, ...rest }: ButtonProps) => (
  <Button size="sm" {...rest}>
    {children}
  </Button>
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

const statusColorMap: Record<DownloadState, ChipProps['color']> = {
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
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'displayIndex',
    direction: 'ascending',
  });
  const [filterValue, setFilterValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<Selection>('all');

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
    next = statusFilter === 'all' ? next : next.filter((item) => statusFilter.has(item.state));
    return next;
  }, [downloadList, filterValue, statusFilter, indexMap, filterTaskId]);

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
        return <span className="font-mono text-[11px] text-muted">{item.displayIndex ?? '—'}</span>;
      case 'state':
        return (
          <Chip className="capitalize" color={statusColorMap[item.state]} size="sm" variant="flat">
            {stateMap[item.state]}
          </Chip>
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
        <Input
          isClearable
          className="max-w-[320px] flex-1"
          placeholder={t('searchFilename')}
          startContent={<SearchIcon />}
          size="sm"
          onClear={() => setFilterValue('')}
          value={filterValue}
          onValueChange={(value) => {
            if (value) {
              setPage(1);
              setFilterValue(value);
            } else {
              setFilterValue('');
            }
          }}
        />
        <Dropdown>
          <DropdownTrigger>
            <Button
              size="sm"
              endContent={<ChevronDownIcon className="text-small" />}
              variant="flat"
            >
              {t('filter')}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            disallowEmptySelection
            closeOnSelect={false}
            selectedKeys={statusFilter}
            selectionMode="multiple"
            onSelectionChange={setStatusFilter}
          >
            {stateSelections.map((state) => (
              <DropdownItem key={state.id} className="capitalize">
                {state.label}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        <span className="text-xs text-muted">{t('itemsCount', String(filteredList.length))}</span>
      </div>
      <Table
        isHeaderSticky
        sortDescriptor={sortDescriptor}
        onSortChange={setSortDescriptor}
        removeWrapper={false}
        classNames={{
          base: 'min-h-0 flex-1 overflow-hidden',
          wrapper: 'min-h-0 h-full overflow-auto p-0',
          th: 'text-[11px] font-medium h-8',
          td: 'text-xs py-1.5',
          tr: 'h-9',
        }}
      >
        <TableHeader columns={columns()}>
          {(col) => (
            <TableColumn key={col.key} width={col.width}>
              {col.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody items={filteredList.slice((page - 1) * pageSize, page * pageSize)}>
          {(item) => (
            <TableRow key={item.id}>
              {(key) => <TableCell>{renderCell(item, key as string)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex shrink-0 items-center justify-center pt-1">
        <Pagination
          isCompact
          showControls
          color="primary"
          size="sm"
          total={Math.max(1, Math.ceil(filteredList.length / pageSize))}
          page={page}
          onChange={setPage}
        />
      </div>
    </div>
  );
};
