import type { FC } from 'react';
import { useMemo, useState } from 'react';
import {
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@nextui-org/react';
import { toast } from 'sonner';

import { startDownload } from '@/download/client';
import { resolveGalleryDownloadPath } from '@/download/download-filename';
import { useStorageSuspense } from '@/hooks';
import {
  configStorage,
  type DownloadHistoryItem,
  downloadHistoryStorage,
  type GalleryRecord,
  galleryRecordsStorage,
  MAX_DOWNLOAD_HISTORY,
  MAX_GALLERY_RECORDS,
} from '@/storage';
import { t } from '@/utils/i18n';

import { EhButton } from './eh-button';
import { ehTableClassNames, EhTableFrame } from './eh-table';
import { GalleryDetailModal } from './gallery-detail-modal';

const columns = () => [
  { key: 'name', label: t('colName') },
  { key: 'status', label: t('colStatus') },
  { key: 'range', label: t('colRange') },
  { key: 'time', label: t('colTime') },
  { key: 'op', label: t('colOp') },
];

const formatTime = (ts: number) => new Date(ts).toLocaleString();

const formatStatus = (record: GalleryRecord | undefined, range: [number, number]) => {
  if (!record) return t('statusUnknown');
  let complete = 0;
  for (let i = range[0]; i <= range[1]; i++) {
    if (record.images[String(i)]?.state === 'complete') complete++;
  }
  const total = range[1] - range[0] + 1;
  return t('statusCompleteRatio', [String(complete), String(total)]);
};

const buildPayloadFromHistory = async (item: DownloadHistoryItem) => {
  const config = await configStorage.get();
  const imagesPerPage = 20;
  const totalImages = item.info.numImages;
  const numPages = Math.ceil(totalImages / imagesPerPage);
  const downloadPath = resolveGalleryDownloadPath(config.intermediateDownloadPath, item.name);

  return {
    galleryFrontPageUrl: item.url,
    galleryName: item.name,
    galleryId: item.info.id,
    downloadPath,
    rangeStart: item.range[0],
    rangeEnd: item.range[1],
    imagesPerPage,
    numPages,
    totalImages,
  };
};

export const History: FC = () => {
  const list = useStorageSuspense(downloadHistoryStorage) || [];
  const galleryRecords = useStorageSuspense(galleryRecordsStorage) || {};
  const data = useMemo<DownloadHistoryItem[]>(() => {
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }, [list]);
  const [keyword, setKeyword] = useState('');
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DownloadHistoryItem | null>(null);

  const filteredData = useMemo<DownloadHistoryItem[]>(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return data;
    return data.filter((item) => item.name.toLowerCase().includes(kw));
  }, [data, keyword]);

  const activeRecord = activeUrl ? galleryRecords[activeUrl] ?? null : null;

  const handleRedownload = async (item: DownloadHistoryItem) => {
    const payload = await buildPayloadFromHistory(item);
    const res = await startDownload(payload);
    if (res?.ok) toast.success(t('downloadStarted'));
    else toast.error(t('failedStartDownload'));
  };

  const galleryCount = Object.keys(galleryRecords).length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <p className="shrink-0 text-xs leading-relaxed text-muted-soft">
        {t('storageLimitHint', [
          String(data.length),
          String(MAX_DOWNLOAD_HISTORY),
          String(galleryCount),
          String(MAX_GALLERY_RECORDS),
        ])}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <Input
          size="sm"
          placeholder={t('searchByName')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          isClearable
          onClear={() => setKeyword('')}
          className="max-w-[280px] flex-1"
        />
        <span className="text-xs text-muted">
          {t('recordsCount', [String(filteredData.length), String(data.length)])}
        </span>
        <div className="flex-1" />
        <EhButton variant="danger" ehSize="sm" onPress={() => setConfirmClear(true)}>
          {t('clearAll')}
        </EhButton>
      </div>
      <EhTableFrame>
        <Table
          aria-label="download history"
          isHeaderSticky
          removeWrapper
          classNames={ehTableClassNames()}
        >
          <TableHeader columns={columns()}>
            {(col) => (
              <TableColumn
                key={col.key}
                width={
                  col.key === 'name'
                    ? 220
                    : col.key === 'status'
                      ? 108
                      : col.key === 'time'
                        ? 128
                        : col.key === 'op'
                          ? 220
                          : 64
                }
              >
                {col.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody items={filteredData} emptyContent={t('noHistory')}>
            {(item) => (
              <TableRow key={item.timestamp}>
                <TableCell className="eh-table-cell--clip">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="eh-url-link text-xs text-primary underline underline-offset-2"
                    title={item.name}
                  >
                    {item.name}
                  </a>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted">
                  {formatStatus(galleryRecords[item.url], item.range)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-soft">
                  {item.range[0]}-{item.range[1]}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-soft">
                  {formatTime(item.timestamp)}
                </TableCell>
                <TableCell className="py-1.5">
                  <div className="flex flex-nowrap items-center gap-0.5">
                    <EhButton
                      variant="secondary"
                      ehSize="sm"
                      onPress={() => void handleRedownload(item)}
                    >
                      {t('redownload')}
                    </EhButton>
                    <EhButton
                      variant="secondary"
                      ehSize="sm"
                      disabled={!galleryRecords[item.url]}
                      onPress={() => setActiveUrl(item.url)}
                    >
                      {t('detail')}
                    </EhButton>
                    <EhButton variant="danger" ehSize="sm" onPress={() => setDeleteTarget(item)}>
                      {t('delete')}
                    </EhButton>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </EhTableFrame>
      <GalleryDetailModal
        isOpen={activeUrl !== null}
        onClose={() => setActiveUrl(null)}
        record={activeRecord}
      />
      <Modal isOpen={confirmClear} onClose={() => setConfirmClear(false)} size="sm">
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader>{t('clearAll')}</ModalHeader>
              <ModalBody className="text-sm text-muted">{t('confirmClearAll')}</ModalBody>
              <ModalFooter>
                <EhButton variant="secondary" ehSize="sm" onPress={close}>
                  {t('cancel')}
                </EhButton>
                <EhButton
                  variant="danger"
                  ehSize="sm"
                  onPress={() => {
                    downloadHistoryStorage.clear();
                    galleryRecordsStorage.clear();
                    close();
                  }}
                >
                  {t('clearAll')}
                </EhButton>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <Modal isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} size="sm">
        <ModalContent>
          {(close) => (
            <>
              <ModalHeader>{t('delete')}</ModalHeader>
              <ModalBody className="text-sm text-muted">{t('confirmDelete')}</ModalBody>
              <ModalFooter>
                <EhButton variant="secondary" ehSize="sm" onPress={close}>
                  {t('cancel')}
                </EhButton>
                <EhButton
                  variant="danger"
                  ehSize="sm"
                  onPress={() => {
                    if (deleteTarget) {
                      downloadHistoryStorage.remove(deleteTarget.timestamp);
                      galleryRecordsStorage.removeGallery(deleteTarget.url);
                    }
                    close();
                  }}
                >
                  {t('delete')}
                </EhButton>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
