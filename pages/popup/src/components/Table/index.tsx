import {
  Button,
  Chip,
  ChipProps,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Pagination,
  Selection,
  SortDescriptor,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@nextui-org/react';
import { FC, useMemo, useState } from 'react';

import { ChevronDownIcon } from './ChevronDownIcon';
import { SearchIcon } from './SearchIcon';

const pageSize = 10;

type DownloadItem = chrome.downloads.DownloadItem;

const columns = [
  {
    key: 'id',
  },
  {
    key: 'state',
  },
  {
    key: 'filename',
  },
  // {
  //   key: 'operation',
  // },
];
const stateMap: Record<DownloadItem['state'], React.ReactNode> = {
  in_progress: <>🙈Downloading</>,
  interrupted: <>❌Interrupted</>,
  complete: <>🌈Complete</>,
};
const statusColorMap: Record<DownloadItem['state'], ChipProps['color']> = {
  complete: 'success',
  in_progress: 'warning',
  interrupted: 'danger',
};

const DownloadTable: FC<{
  downloadList: DownloadItem[];
  imageIdMap: Map<number, number>;
}> = ({ downloadList }) => {
  const [page, setPage] = useState(1);

  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'id',
    direction: 'ascending',
  });

  const [filterValue, setFilterValue] = useState('');
  const handleClearFilter = () => {
    setPage(1);
    setFilterValue('');
  };
  const onSearchChange = (value: string) => {
    if (value) {
      setPage(1);
      setFilterValue(value);
    } else {
      handleClearFilter();
    }
  };

  const [statusFilter, setStatusFilter] = useState<Selection>('all');
  const stateSelections: { label: string; id: DownloadItem['state'] }[] = [
    { id: 'complete', label: 'Complete' },
    { id: 'in_progress', label: 'InProgress' },
    { id: 'interrupted', label: 'Interrupted' },
  ];
  const filteredList = useMemo(() => {
    const pathFormattedList = downloadList.map(item => {
      const localPathArr = item.filename.replace(/\\/g, '/').split('/');
      console.log('item@', item, localPathArr);
      const filename = localPathArr[localPathArr.length - 1] ?? localPathArr[localPathArr.length - 2];
      return {
        ...item,
        filename,
      };
    });
    const list = filterValue
      ? pathFormattedList.filter(item => item.filename.includes(filterValue))
      : pathFormattedList;
    return statusFilter === 'all' ? list : list.filter(item => statusFilter.has(item.state));
  }, [filterValue, statusFilter, downloadList]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          isClearable
          className="w-full max-w-[50%]"
          placeholder="Search by filename..."
          startContent={<SearchIcon />}
          onClear={handleClearFilter}
          value={filterValue}
          onValueChange={onSearchChange}
        />

        <Dropdown>
          <DropdownTrigger>
            <Button endContent={<ChevronDownIcon className="text-small" />} variant="flat">
              State
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            disallowEmptySelection
            closeOnSelect={false}
            selectedKeys={statusFilter}
            selectionMode="multiple"
            onSelectionChange={setStatusFilter}>
            {stateSelections.map(state => (
              <DropdownItem key={state.id} className="capitalize">
                {state.label}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
      </div>
      <Table
        className="w-[680px]"
        aria-label="table"
        isHeaderSticky
        sortDescriptor={sortDescriptor}
        onSortChange={setSortDescriptor}
        bottomContent={
          <div className="flex w-full justify-center">
            <Pagination
              isCompact
              showControls
              showShadow
              color="secondary"
              total={Math.ceil(filteredList.length / pageSize)}
              page={page}
              onChange={setPage}
            />
          </div>
        }
        classNames={{
          wrapper: 'h-[445px]',
        }}>
        <TableHeader columns={columns}>
          {column => (
            <TableColumn key={column.key} width={200}>
              {column.key.toUpperCase()}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody items={filteredList.slice((page - 1) * pageSize, page * pageSize)}>
          {item => (
            <TableRow key={item.id}>
              {key => {
                if (key === 'state')
                  return (
                    <TableCell>
                      <Chip className="capitalize" color={statusColorMap[item.state]} size="sm" variant="flat">
                        {stateMap[item.state]}
                      </Chip>
                    </TableCell>
                  );
                if (key === 'operation') {
                  const { state } = item;
                  if (state !== 'complete') {
                    return (
                      <TableCell>
                        {/* TODO */}
                        <Button>Redownload</Button>
                      </TableCell>
                    );
                  }
                  return <></>;
                }
                return <TableCell>{item[key]}</TableCell>;
              }}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default DownloadTable;
