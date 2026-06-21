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

import { useCreation, useStorageSuspense } from '@/hooks';
import { downloadIndexMapStorage, downloadListStorage } from '@/storage';

import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { SearchIcon } from './icons/SearchIcon';

const pageSize = 6;

type DownloadItem = chrome.downloads.DownloadItem;
type DownloadState = DownloadItem['state'];

const CellButton = ({ children, ...rest }: ButtonProps) => (
  <Button size="sm" {...rest}>
    {children}
  </Button>
);

const columns = [
  { key: 'id', label: 'ID', width: 64 },
  { key: 'state', label: 'STATE', width: 100 },
  { key: 'filename', label: 'FILE', width: 300 },
  { key: 'operation', label: 'ACTION', width: 156 },
];

const stateMap: Record<DownloadState, ReactNode> = {
  in_progress: <>Downloading</>,
  interrupted: <>Interrupted</>,
  complete: <>Complete</>,
};

const statusColorMap: Record<DownloadState, ChipProps['color']> = {
  complete: 'success',
  in_progress: 'warning',
  interrupted: 'danger',
};

export const DownloadTable: FC = () => {
  const list = useStorageSuspense(downloadListStorage) || [];
  const indexMap = useStorageSuspense(downloadIndexMapStorage) || {};
  const [downloadList, setDownloadList] = useState(list);
  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'id',
    direction: 'ascending',
  });
  const [filterValue, setFilterValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<Selection>('all');

  useEffect(() => {
    setDownloadList(list);
  }, [list]);

  const stateSelections: { label: string; id: DownloadItem['state'] }[] = [
    { id: 'complete', label: 'Complete' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'interrupted', label: 'Interrupted' },
  ];

  const filteredList = useMemo(() => {
    let next = downloadList.map((item) => {
      const localPathArr = item.filename.replace(/\\/g, '/').split('/');
      const filename =
        localPathArr[localPathArr.length - 1] ?? localPathArr[localPathArr.length - 2];
      return {
        ...item,
        filename,
      };
    });
    next = filterValue ? next.filter((item) => item.filename.includes(filterValue)) : next;
    next = statusFilter === 'all' ? next : next.filter((item) => statusFilter.has(item.state));
    return next;
  }, [downloadList, filterValue, statusFilter]);

  const pausedIdSet = useCreation(() => new Set<number>());

  const renderCell = (item: DownloadItem, key: string) => {
    const { state, id, url } = item;
    const paused = pausedIdSet.has(id);
    const PauseButton = (
      <CellButton
        onClick={() => {
          paused
            ? chrome.downloads.resume(id, () => {
                pausedIdSet.delete(id);
              })
            : chrome.downloads.pause(id, () => {
                pausedIdSet.add(id);
              });
        }}
      >
        {paused ? 'Resume' : 'Pause'}
      </CellButton>
    );
    const RestartButton = (
      <CellButton
        onClick={() => {
          chrome.downloads.cancel(id, () => {
            const entry = indexMap[String(id)];
            const number = entry?.index;
            const restartUrl = entry?.sourceUrl || url;
            setDownloadList((list) => {
              const newList = [...list];
              const index = newList.findIndex((item) => item.id === id);
              newList.splice(index, 1);
              return newList;
            });
            chrome.downloads.download({ url: restartUrl }, (newId) => {
              void chrome.runtime.sendMessage({
                type: 'register-download-index',
                id: newId,
                index: number ?? 0,
                total: entry?.total ?? 0,
                downloadPath: entry?.downloadPath,
                galleryUrl: entry?.galleryUrl,
                sourceUrl: entry?.sourceUrl,
              });
            });
          });
        }}
      >
        Restart
      </CellButton>
    );

    const operationMap = {
      interrupted: () => RestartButton,
      in_progress: () => (
        <div className="flex gap-1">
          {PauseButton}
          {RestartButton}
        </div>
      ),
      complete: () => null,
    };

    switch (key) {
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
    <div className="flex h-popup-content min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <Input
          isClearable
          className="max-w-[320px] flex-1"
          placeholder="Search filename..."
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
              Filter
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
        <span className="text-xs text-muted">{filteredList.length} items</span>
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
        <TableHeader columns={columns}>
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
