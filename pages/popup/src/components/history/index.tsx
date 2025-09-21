import { FC, useMemo, useState } from 'react';
import { useStorageSuspense } from '@ehentai-helper/shared';
import { type DownloadHistoryItem, downloadHistoryStorage } from '@ehentai-helper/storage';
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

const columns = [
  { key: 'name', label: 'NAME' },
  { key: 'range', label: 'RANGE' },
  { key: 'time', label: 'TIME' },
  { key: 'op', label: 'OPERATION' },
];

const formatTime = (ts: number) => new Date(ts).toLocaleString();

const History: FC = () => {
  const list = useStorageSuspense(downloadHistoryStorage) || [];

  const data = useMemo<DownloadHistoryItem[]>(() => {
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }, [list]);

  const [keyword, setKeyword] = useState('');
  const filteredData = useMemo<DownloadHistoryItem[]>(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return data;
    return data.filter(item => item.name.toLowerCase().includes(kw));
  }, [data, keyword]);

  return (
    <div className="flex w-[640px] flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Input
            size="sm"
            placeholder="Search by name..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            isClearable
            onClear={() => setKeyword('')}
            className="w-64"
          />
          <div className="text-sm text-gray-400">
            Records：{filteredData.length} / {data.length}
          </div>
        </div>
        <Button size="sm" color="danger" variant="flat" onPress={() => downloadHistoryStorage.clear()}>
          Clear All
        </Button>
      </div>
      <Table aria-label="download history">
        <TableHeader columns={columns}>
          {col => (
            <TableColumn key={col.key} width={col.key === 'name' ? 260 : 100}>
              {col.label}
            </TableColumn>
          )}
        </TableHeader>

        <TableBody items={filteredData}>
          {item => (
            <TableRow key={item.timestamp}>
              <TableCell title={item.name}>
                <Link href={item.url} isExternal className="text-primary-400 text-sm underline underline-offset-2">
                  {item.name}
                </Link>
              </TableCell>
              <TableCell>
                {item.range[0]} - {item.range[1]}
              </TableCell>
              <TableCell>{formatTime(item.timestamp)}</TableCell>
              <TableCell>
                <Button size="sm" variant="flat" onPress={() => downloadHistoryStorage.remove(item.timestamp)}>
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

export default History;
