import {
  Button,
  Input,
  Link,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@nextui-org/react';
import { FC, useMemo, useState } from 'react';

import { useStorageSuspense } from '@/shared';
import { downloadHistoryStorage, type DownloadHistoryItem } from '@/storage';

const columns = [
  { key: 'name', label: 'NAME' },
  { key: 'range', label: 'RANGE' },
  { key: 'time', label: 'TIME' },
  { key: 'op', label: 'OP' },
];

const formatTime = (ts: number) => new Date(ts).toLocaleString();

export const History: FC = () => {
  const list = useStorageSuspense(downloadHistoryStorage) || [];
  const data = useMemo<DownloadHistoryItem[]>(() => {
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }, [list]);
  const [keyword, setKeyword] = useState('');
  const filteredData = useMemo<DownloadHistoryItem[]>(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return data;
    return data.filter((item) => item.name.toLowerCase().includes(kw));
  }, [data, keyword]);

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
          onPress={() => downloadHistoryStorage.clear()}
        >
          Clear All
        </Button>
      </div>
      <Table
        aria-label="download history"
        classNames={{
          wrapper: 'min-h-0 flex-1 overflow-auto',
          th: 'text-xs',
          td: 'text-sm',
        }}
      >
        <TableHeader columns={columns}>
          {(col) => (
            <TableColumn
              key={col.key}
              width={col.key === 'name' ? 280 : col.key === 'time' ? 160 : 80}
            >
              {col.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody items={filteredData}>
          {(item) => (
            <TableRow key={item.timestamp}>
              <TableCell title={item.name}>
                <Link
                  href={item.url}
                  isExternal
                  className="line-clamp-1 text-sm text-primary underline underline-offset-2"
                >
                  {item.name}
                </Link>
              </TableCell>
              <TableCell className="text-default-400">
                {item.range[0]}–{item.range[1]}
              </TableCell>
              <TableCell className="whitespace-nowrap text-default-400">
                {formatTime(item.timestamp)}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => downloadHistoryStorage.remove(item.timestamp)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
