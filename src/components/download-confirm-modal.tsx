import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@nextui-org/react';

import { estimateDownloadSeconds } from '@/download/helpers';
import { t } from '@/utils/i18n';

export const DownloadConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  imageCount,
  range,
  downloadPath,
  intervalMs,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  imageCount: number;
  range: [number, number];
  downloadPath: string;
  intervalMs: number;
}) => (
  <Modal isOpen={isOpen} onClose={onClose} size="md">
    <ModalContent>
      {(close) => (
        <>
          <ModalHeader>{t('confirmDownload')}</ModalHeader>
          <ModalBody className="gap-2 text-sm text-muted">
            <p>
              <span className="font-semibold text-ink">{imageCount}</span> {t('confirmDownloadBody')}{' '}
              <span className="font-mono text-brand-accent">
                {range[0]}–{range[1]}
              </span>
            </p>
            <p className="break-all">
              <span className="text-muted-soft">{t('defaultFolder')}</span>
              {downloadPath}
            </p>
            <p className="text-[12px] text-muted-soft">
              {t('estimatedTime')}: ~{estimateDownloadSeconds(imageCount, intervalMs)}
              {t('seconds')}
            </p>
          </ModalBody>
          <ModalFooter className="gap-2">
            <Button variant="light" onPress={close}>
              {t('cancel')}
            </Button>
            <Button
              color="primary"
              onPress={() => {
                onConfirm();
                close();
              }}
            >
              {t('startDownload')}
            </Button>
          </ModalFooter>
        </>
      )}
    </ModalContent>
  </Modal>
);
