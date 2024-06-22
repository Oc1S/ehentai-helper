import { useCreation } from '@ehentai-helper/shared';
import {
  Button,
  ButtonProps,
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
import { useForceUpdate } from 'framer-motion';
import { FC, useContext, useMemo, useState } from 'react';

import { DownloadContext } from '@/Context';

import { ChevronDownIcon } from './ChevronDownIcon';
import { SearchIcon } from './SearchIcon';

const pageSize = 10;

type DownloadItem = chrome.downloads.DownloadItem;
type DownloadState = DownloadItem['state'];

const CellButton = ({ children, ...rest }: ButtonProps) => {
  return (
    <Button size="sm" {...rest}>
      {children}
    </Button>
  );
};

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
  {
    key: 'operation',
  },
];
const stateMap: Record<DownloadState, React.ReactNode> = {
  in_progress: <>🙈Downloading</>,
  interrupted: <>❌Interrupted</>,
  complete: <>🌈Complete</>,
};
const statusColorMap: Record<DownloadState, ChipProps['color']> = {
  complete: 'success',
  in_progress: 'warning',
  interrupted: 'danger',
};

const DownloadTable: FC = () => {
  const { imageIdMap, downloadList, setDownloadList } = useContext(DownloadContext);
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
    let list = downloadList.map(item => {
      const localPathArr = item.filename.replace(/\\/g, '/').split('/');
      const filename = localPathArr[localPathArr.length - 1] ?? localPathArr[localPathArr.length - 2];
      return {
        ...item,
        filename,
      };
    });
    console.log('list@');
    /* search input filter */
    list = filterValue ? list.filter(item => item.filename.includes(filterValue)) : list;
    /* status filter */
    list = statusFilter === 'all' ? list : list.filter(item => statusFilter.has(item.state));
    return list;
  }, [filterValue, statusFilter, downloadList]);

  const [update] = useForceUpdate();
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
          update();
        }}>
        {paused ? 'Resume' : 'Pause'}
      </CellButton>
    );
    const RestartButton = (
      <CellButton
        onClick={() => {
          chrome.downloads.cancel(id, () => {
            const number = imageIdMap.get(id)!;
            setDownloadList(list => {
              const newList = [...list];
              const index = newList.findIndex(item => item.id === id);
              newList.splice(index, 1);
              return newList;
            });
            chrome.downloads.download({ url }, newId => {
              imageIdMap.delete(id);
              imageIdMap.set(newId, number);
            });
          });
        }}>
        Restart
      </CellButton>
    );
    const operationMap = {
      interrupted: () => RestartButton,
      in_progress: () => (
        <div className="flex gap-2">
          {PauseButton}
          {RestartButton}
        </div>
      ),
      complete: () => <></>,
    };
    switch (key) {
      case 'state':
        return (
          <Chip className="capitalize" color={statusColorMap[item.state]} size="sm" variant="flat">
            {stateMap[item.state]}
          </Chip>
        );
      case 'operation':
        return operationMap[state]();
      default:
        return item[key];
    }
  };

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
          wrapper: 'h-[440px]',
        }}>
        <TableHeader columns={columns}>
          {({ key }) => {
            return (
              <TableColumn key={key} width={key === 'id' ? 100 : 200}>
                {key.toUpperCase()}
              </TableColumn>
            );
          }}
        </TableHeader>
        <TableBody items={filteredList.slice((page - 1) * pageSize, page * pageSize)}>
          {item => <TableRow key={item.id}>{key => <TableCell>{renderCell(item, key as string)}</TableCell>}</TableRow>}
        </TableBody>
      </Table>
    </div>
  );
};

export default DownloadTable;
