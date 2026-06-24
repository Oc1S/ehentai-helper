import { type FC, useMemo, useState } from 'react';
import {
  Button,
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
import { t } from '@/utils/i18n';

import { ehTableClassNames, EhTableFrame } from './eh-table';
import { SearchIcon } from './icons/SearchIcon';

const STATE_COLOR: Record<GalleryImageState, ChipProps['color']> = {
  complete: 'success',
  in_progress: 'warning',
  interrupted: 'danger',
};

const stateLabel = (state: GalleryImageState) => {
  switch (state) {
    case 'complete':
      return t('stateComplete');
    case 'in_progress':
      return t('stateInProgress');
    case 'interrupted':
      return t('stateFailed');
  }
};

type FilterKey = 'all' | GalleryImageState;

const summaryTabs = (): { id: FilterKey; label: string }[] => [
  { id: 'all', label: t('filterAll') },
  { id: 'complete', label: t('stateComplete') },
  { id: 'in_progress', label: t('stateInProgress') },
  { id: 'interrupted', label: t('stateFailed') },
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
  onRetryIndex?: (index: number) => void;
  onRetryAllFailed?: () => void;
}> = ({ isOpen, onClose, record, onRetryIndex, onRetryAllFailed }) => {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [keyword, setKeyword] = useState('');

  const rows = useMemo(() => {
    if (!record?.images) return [];
    return Object.values(record.images).sort((a, b) => a.index - b.index);
  }, [record]);

  const counts = useMemo(() => {
    const c = { complete: 0, in_progress: 0, interrupted: 0 };
    for (const r of rows) {
      if (r.state in c) c[r.state] += 1;
    }
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
                {record?.galleryName || t('galleryDetails')}
              </span>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <span>
                  {t('total')}: {record?.total ?? 0}
                </span>
                <Chip color="success" size="sm" variant="flat">
                  {t('countDone', String(counts.complete))}
                </Chip>
                <Chip color="warning" size="sm" variant="flat">
                  {t('countInProgressShort', String(counts.in_progress))}
                </Chip>
                <Chip color="danger" size="sm" variant="flat">
                  {t('countFailedShort', String(counts.interrupted))}
                </Chip>
              </div>
            </ModalHeader>
            <ModalBody className="gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <Input
                  isClearable
                  size="sm"
                  placeholder={t('searchDetail')}
                  startContent={<SearchIcon />}
                  className="max-w-[320px] flex-1"
                  value={keyword}
                  onValueChange={setKeyword}
                  onClear={() => setKeyword('')}
                />
                <Tabs
                  size="sm"
                  selectedKey={filter}
                  onSelectionChange={(k) => {
                    if (typeof k === 'string') setFilter(k as FilterKey);
                  }}
                  aria-label="state filter"
                >
                  {summaryTabs().map((tab) => (
                    <Tab key={tab.id} title={tab.label} />
                  ))}
                </Tabs>
                <span className="text-[11px] text-muted">
                  {t('itemsCount', String(filteredRows.length))}
                </span>
              </div>
              <EhTableFrame className="max-h-[420px] flex-none">
                <Table
                  aria-label="gallery image records"
                  isHeaderSticky
                  removeWrapper
                  classNames={ehTableClassNames()}
                >
                <TableHeader>
                  <TableColumn width={64}>{t('colIndex')}</TableColumn>
                  <TableColumn width={100}>{t('colState')}</TableColumn>
                  <TableColumn>{t('colFileUrl')}</TableColumn>
                  {(onRetryIndex || onRetryAllFailed) && (
                    <TableColumn width={88}>{t('colAction')}</TableColumn>
                  )}
                </TableHeader>
                <TableBody items={filteredRows} emptyContent={t('noRecords')}>
                  {(row) => (
                    <TableRow key={row.index}>
                      <TableCell>{row.index}</TableCell>
                      <TableCell>
                        <Chip color={STATE_COLOR[row.state]} size="sm" variant="flat">
                          {stateLabel(row.state)}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="line-clamp-1 text-ink" title={row.filename || ''}>
                            {trimFilename(row.filename) || '-'}
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
                      {(onRetryIndex || onRetryAllFailed) ? (
                        <TableCell>
                          {onRetryIndex && row.state === 'interrupted' ? (
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => onRetryIndex(row.index)}
                            >
                              {t('retry')}
                            </Button>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  )}
                </TableBody>
                </Table>
              </EhTableFrame>
            </ModalBody>
            <ModalFooter className="gap-2">
              {onRetryAllFailed && counts.interrupted > 0 && (
                <Button size="sm" color="primary" variant="flat" onPress={onRetryAllFailed}>
                  {t('retryAllFailed', String(counts.interrupted))}
                </Button>
              )}
              <button
                type="button"
                onClick={close}
                className="rounded-md border border-hairline bg-surface-soft px-3 py-1.5 text-xs text-body hover:text-ink"
              >
                {t('close')}
              </button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
