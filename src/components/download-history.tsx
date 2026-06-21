import type { FC } from 'react';
import { useMemo, useState } from 'react';
import {
  Button,
  Chip,
  Input,
  Link,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@nextui-org/react';

import { useStorageSuspense } from '@/hooks';
import {
  type DownloadHistoryItem,
  downloadHistoryStorage,
  type GalleryImageState,
  type GalleryRecord,
  galleryRecordsStorage,
} from '@/storage';

import { GalleryDetailModal } from './gallery-detail-modal';

const columns = [
  { key: 'name', label: 'NAME' },
  { key: 'status', label: 'STATUS' },
  { key: 'range', label: 'RANGE' },
  { key: 'time', label: 'TIME' },
  { key: 'op', label: 'OP' },
];

const formatTime = (ts: number) => new Date(ts).toLocaleString();

const computeCounts = (record: GalleryRecord | undefined) => {
  const counts: Record<GalleryImageState, number> = {
    complete: 0,
    in_progress: 0,
    interrupted: 0,
  };
  if (!record) return counts;
  for (const img of Object.values(record.images)) counts[img.state] += 1;
  return counts;
};

export const History: FC = () => {
  const list = useStorageSuspense(downloadHistoryStorage) || [];
  const galleryRecords = useStorageSuspense(galleryRecordsStorage) || {};
  const data = useMemo<DownloadHistoryItem[]>(() => {
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }, [list]);
  const [keyword, setKeyword] = useState('');
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  const filteredData = useMemo<DownloadHistoryItem[]>(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return data;
    return data.filter((item) => item.name.toLowerCase().includes(kw));
  }, [data, keyword]);

  const activeRecord = activeUrl ? galleryRecords[activeUrl] ?? null : null;

  return (
    <div className="flex h-popup-content min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <Input
          size="sm"
          placeholder="Search by name..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          isClearable
          onClear={() => setKeyword('')}
          className="max-w-[280px] flex-1"
        />
        <span className="text-xs text-muted">
          {filteredData.length} / {data.length} records
        </span>
        <div className="flex-1" />
        <Button
          size="sm"
          color="danger"
          variant="flat"
          onPress={() => {
            downloadHistoryStorage.clear();
            galleryRecordsStorage.clear();
          }}
        >
          Clear All
        </Button>
      </div>
      <Table
        aria-label="download history"
        isHeaderSticky
        classNames={{
          base: 'min-h-0 flex-1 overflow-hidden',
          wrapper: 'min-h-0 h-full overflow-auto p-0',
          th: 'text-[11px] h-8',
          td: 'text-xs py-1.5',
          tr: 'h-9',
        }}
      >
        <TableHeader columns={columns}>
          {(col) => (
            <TableColumn
              key={col.key}
              width={
                col.key === 'name'
                  ? 240
                  : col.key === 'status'
                    ? 160
                    : col.key === 'time'
                      ? 150
                      : col.key === 'op'
                        ? 110
                        : 70
              }
            >
              {col.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody items={filteredData} emptyContent="No history">
          {(item) => {
            const counts = computeCounts(galleryRecords[item.url]);
            const tracked =
              counts.complete + counts.in_progress + counts.interrupted;
            return (
              <TableRow key={item.timestamp}>
                <TableCell title={item.name}>
                  <Link
                    href={item.url}
                    isExternal
                    className="line-clamp-1 text-xs text-primary underline underline-offset-2"
                  >
                    {item.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {tracked === 0 ? (
                    <span className="text-[11px] text-muted-soft">—</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1">
                      <Chip size="sm" color="success" variant="flat">
                        {counts.complete}
                      </Chip>
                      <Chip size="sm" color="warning" variant="flat">
                        {counts.in_progress}
                      </Chip>
                      <Chip size="sm" color="danger" variant="flat">
                        {counts.interrupted}
                      </Chip>
                    </div>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-default-400">
                  {item.range[0]}–{item.range[1]}
                </TableCell>
                <TableCell className="whitespace-nowrap text-default-400">
                  {formatTime(item.timestamp)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="flat"
                      isDisabled={tracked === 0}
                      onPress={() => setActiveUrl(item.url)}
                    >
                      Detail
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      color="danger"
                      onPress={() => {
                        downloadHistoryStorage.remove(item.timestamp);
                        galleryRecordsStorage.removeGallery(item.url);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          }}
        </TableBody>
      </Table>
      <GalleryDetailModal
        isOpen={activeUrl !== null}
        onClose={() => setActiveUrl(null)}
        record={activeRecord}
      />
    </div>
  );
};
