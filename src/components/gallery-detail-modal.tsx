import { type FC, useMemo, useState } from 'react';

import type { GalleryImageState, GalleryRecord } from '@/storage';
import { t } from '@/utils/i18n';

import { EhButton } from './eh-button';
import { EhTableFrame } from './eh-table';
import { Modal, type PillTone, SegmentedTabs, StatusPill, TextField } from './ui-primitives';

const STATE_COLOR: Record<GalleryImageState, PillTone> = {
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

const detailColumns = (showAction: boolean) => {
  const cols = [
    { key: 'index', label: t('colIndex'), width: 48 },
    { key: 'state', label: t('colState'), width: 68 },
    { key: 'file', label: t('colFileUrl') },
  ];
  if (showAction) {
    cols.push({ key: 'action', label: t('colAction'), width: 88 });
  }
  return cols;
};

export const GalleryDetailModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  record?: GalleryRecord | null;
  taskId?: string;
  indices?: number[];
  totalCount?: number;
  onRetryIndex?: (index: number) => void;
  onRetryAllFailed?: () => void;
}> = ({ isOpen, onClose, record, taskId, indices, onRetryIndex, onRetryAllFailed }) => {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [keyword, setKeyword] = useState('');

  const rows = useMemo(() => {
    if (!record?.images) return [];
    const indexSet = indices?.length ? new Set(indices) : null;
    return Object.values(record.images)
      .filter((image) => {
        if (taskId && image.taskId !== taskId) return false;
        if (indexSet && !indexSet.has(image.index)) return false;
        return true;
      })
      .sort((a, b) => a.index - b.index);
  }, [indices, record, taskId]);

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

  const showAction = Boolean(onRetryIndex || onRetryAllFailed);
  const columns = detailColumns(showAction);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="success">{t('countDone', String(counts.complete))}</StatusPill>
          {counts.in_progress > 0 ? (
            <StatusPill tone="warning">
              {t('countInProgressShort', String(counts.in_progress))}
            </StatusPill>
          ) : null}
          <StatusPill tone="danger">{t('countFailedShort', String(counts.interrupted))}</StatusPill>
        </div>
      }
      footer={
        <>
          <EhButton variant="secondary" ehSize="sm" onPress={onClose}>
            {t('close')}
          </EhButton>
          {onRetryAllFailed && counts.interrupted > 0 && (
            <EhButton variant="primary" ehSize="sm" onPress={onRetryAllFailed}>
              {t('retryAllFailed', String(counts.interrupted))}
            </EhButton>
          )}
        </>
      }
      size="xl"
      bodyClassName="flex min-h-0 flex-col"
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TextField
            placeholder={t('searchDetail')}
            className="min-w-[12rem] max-w-[260px] flex-1"
            value={keyword}
            onValueChange={setKeyword}
            isClearable
          />
          <SegmentedTabs<FilterKey>
            items={summaryTabs()}
            selectedKey={filter}
            onSelectionChange={setFilter}
            ariaLabel="state filter"
            className="shrink-0"
            compact
          />
          <span className="shrink-0 text-xs text-muted">
            {t('itemsCount', String(filteredRows.length))}
          </span>
        </div>
        <EhTableFrame className="min-h-0 flex-1">
          <table className="eh-data-table" aria-label="gallery image records">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} style={{ width: col.width }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-10 text-center text-muted-soft">
                    {t('noRecords')}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.index}>
                    <td>{row.index}</td>
                    <td>
                      <StatusPill tone={STATE_COLOR[row.state]} compact>
                        {stateLabel(row.state)}
                      </StatusPill>
                    </td>
                    <td className="min-w-0 max-w-0 overflow-hidden">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span
                          className="block w-full min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-ink [overflow-wrap:normal] [word-break:normal]"
                          title={row.filename || ''}
                        >
                          {trimFilename(row.filename) || '-'}
                        </span>
                        {row.sourceUrl ? (
                          <a
                            href={row.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block w-full min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted underline-offset-2 [overflow-wrap:normal] [word-break:normal] hover:underline"
                            title={row.sourceUrl}
                          >
                            {row.sourceUrl}
                          </a>
                        ) : null}
                        {row.state === 'interrupted' && row.error ? (
                          <span className="text-xs text-error">{row.error}</span>
                        ) : null}
                      </div>
                    </td>
                    {showAction ? (
                      <td>
                        {onRetryIndex && row.state === 'interrupted' ? (
                          <EhButton
                            variant="primary"
                            ehSize="sm"
                            onPress={() => onRetryIndex(row.index)}
                          >
                            {t('retry')}
                          </EhButton>
                        ) : (
                          '-'
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </EhTableFrame>
      </div>
    </Modal>
  );
};
