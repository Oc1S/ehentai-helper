import type { FC } from 'react';
import { useMemo, useState } from 'react';
import {
  Button,
  Input,
  Link,
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
import { removeInvalidCharFromFilename } from '@/utils';
import { t } from '@/utils/i18n';

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
  if (!record) return '—';
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
  const downloadPath =
    config.intermediateDownloadPath + removeInvalidCharFromFilename(item.name) + '/';

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
    <div className="flex h-popup-content min-h-0 flex-col gap-3">
      <p className="shrink-0 text-[11px] leading-relaxed text-muted-soft">
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
        <Button size="sm" color="danger" variant="flat" onPress={() => setConfirmClear(true)}>
          {t('clearAll')}
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
        <TableHeader columns={columns()}>
          {(col) => (
            <TableColumn
              key={col.key}
              width={
                col.key === 'name'
                  ? 200
                  : col.key === 'status'
                    ? 120
                    : col.key === 'time'
                      ? 140
                      : col.key === 'op'
                        ? 160
                        : 70
              }
            >
              {col.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody items={filteredData} emptyContent={t('noHistory')}>
          {(item) => (
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
              <TableCell className="whitespace-nowrap text-[11px] text-muted">
                {formatStatus(galleryRecords[item.url], item.range)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-default-400">
                {item.range[0]}–{item.range[1]}
              </TableCell>
              <TableCell className="whitespace-nowrap text-default-400">
                {formatTime(item.timestamp)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="flat" onPress={() => void handleRedownload(item)}>
                    {t('redownload')}
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    isDisabled={!galleryRecords[item.url]}
                    onPress={() => setActiveUrl(item.url)}
                  >
                    {t('detail')}
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    onPress={() => setDeleteTarget(item)}
                  >
                    {t('delete')}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
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
                <Button variant="light" onPress={close}>
                  {t('cancel')}
                </Button>
                <Button
                  color="danger"
                  onPress={() => {
                    downloadHistoryStorage.clear();
                    galleryRecordsStorage.clear();
                    close();
                  }}
                >
                  {t('clearAll')}
                </Button>
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
                <Button variant="light" onPress={close}>
                  {t('cancel')}
                </Button>
                <Button
                  color="danger"
                  onPress={() => {
                    if (deleteTarget) {
                      downloadHistoryStorage.remove(deleteTarget.timestamp);
                      galleryRecordsStorage.removeGallery(deleteTarget.url);
                    }
                    close();
                  }}
                >
                  {t('delete')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
