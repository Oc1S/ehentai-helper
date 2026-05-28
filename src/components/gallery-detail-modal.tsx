import { type FC, useMemo, useState } from 'react';
import {
  Chip,
  type ChipProps,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
} from '@nextui-org/react';

import type { GalleryImageState, GalleryRecord } from '@/storage';

import { SearchIcon } from './icons/SearchIcon';

const STATE_COLOR: Record<GalleryImageState, ChipProps['color']> = {
  complete: 'success',
  in_progress: 'warning',
  interrupted: 'danger',
};

const STATE_LABEL: Record<GalleryImageState, string> = {
  complete: 'Complete',
  in_progress: 'In progress',
  interrupted: 'Failed',
};

type FilterKey = 'all' | GalleryImageState;

const SUMMARY_TABS: { id: FilterKey; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'complete', label: 'Complete' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'interrupted', label: 'Failed' },
];

const trimFilename = (filename?: string) => {
  if (!filename) return '';
  const arr = filename.replace(/\\/g, '/').split('/');
  return arr[arr.length - 1] || filename;
};

export const GalleryDetailModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  record?: GalleryRecord | null;
}> = ({ isOpen, onClose, record }) => {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [keyword, setKeyword] = useState('');

  const rows = useMemo(() => {
    if (!record) return [];
    return Object.values(record.images).sort((a, b) => a.index - b.index);
  }, [record]);

  const counts = useMemo(() => {
    const c = { complete: 0, in_progress: 0, interrupted: 0 };
    for (const r of rows) c[r.state] += 1;
    return c;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'all' && r.state !== filter) return false;
      if (!kw) return true;
      const fn = trimFilename(r.filename).toLowerCase();
      return (
        fn.includes(kw) ||
        String(r.index).includes(kw) ||
        (r.sourceUrl || '').toLowerCase().includes(kw)
      );
    });
  }, [rows, filter, keyword]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalContent>
        {(close) => (
          <>
            <ModalHeader className="flex flex-col gap-1.5">
              <span className="line-clamp-1 text-base font-semibold text-ink">
                {record?.galleryName || 'Gallery details'}
              </span>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <span>Total: {record?.total ?? 0}</span>
                <Chip color="success" size="sm" variant="flat">
                  {counts.complete} done
                </Chip>
                <Chip color="warning" size="sm" variant="flat">
                  {counts.in_progress} in-progress
                </Chip>
                <Chip color="danger" size="sm" variant="flat">
                  {counts.interrupted} failed
                </Chip>
              </div>
            </ModalHeader>
            <ModalBody className="gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <Input
                  isClearable
                  size="sm"
                  placeholder="Search index / filename / url..."
                  startContent={<SearchIcon />}
                  className="max-w-[320px] flex-1"
                  value={keyword}
                  onValueChange={setKeyword}
                  onClear={() => setKeyword('')}
                />
                <Tabs
                  size="sm"
                  selectedKey={filter}
                  onSelectionChange={(k) => setFilter(k as FilterKey)}
                  aria-label="state filter"
                >
                  {SUMMARY_TABS.map((t) => (
                    <Tab key={t.id} title={t.label} />
                  ))}
                </Tabs>
                <span className="text-[11px] text-muted">{filteredRows.length} items</span>
              </div>
              <Table
                aria-label="gallery image records"
                isHeaderSticky
                classNames={{
                  base: 'max-h-[420px]',
                  wrapper: 'min-h-0 overflow-auto p-0',
                  th: 'text-[11px] h-8',
                  td: 'text-xs py-1.5',
                  tr: 'h-9',
                }}
              >
                <TableHeader>
                  <TableColumn width={64}>#</TableColumn>
                  <TableColumn width={100}>STATE</TableColumn>
                  <TableColumn>FILE / URL</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No records">
                  {filteredRows.map((row) => (
                    <TableRow key={row.index}>
                      <TableCell>{row.index}</TableCell>
                      <TableCell>
                        <Chip color={STATE_COLOR[row.state]} size="sm" variant="flat">
                          {STATE_LABEL[row.state]}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="line-clamp-1 text-ink" title={row.filename || ''}>
                            {trimFilename(row.filename) || '—'}
                          </span>
                          {row.sourceUrl ? (
                            <a
                              href={row.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="line-clamp-1 text-[11px] text-muted underline-offset-2 hover:underline"
                              title={row.sourceUrl}
                            >
                              {row.sourceUrl}
                            </a>
                          ) : null}
                          {row.error ? (
                            <span className="text-[11px] text-error">{row.error}</span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ModalBody>
            <ModalFooter>
              <button
                type="button"
                onClick={close}
                className="rounded-md border border-hairline bg-surface-soft px-3 py-1.5 text-xs text-body hover:text-ink"
              >
                Close
              </button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
