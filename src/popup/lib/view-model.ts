import type { ActiveDownloadTask } from '@/storage';

import { CENTERED_STATUSES, StatusEnum } from '../status';

const taskStatusToUi = (taskStatus: string): StatusEnum | null => {
  switch (taskStatus) {
    case 'running':
    case 'dispatch_complete':
      return StatusEnum.Downloading;
    case 'completed':
      return StatusEnum.DownloadSuccess;
    case 'partial_success':
      return StatusEnum.DownloadPartialSuccess;
    case 'failed':
      return StatusEnum.DownloadFailed;
    case 'cancelled':
      return StatusEnum.BeforeDownload;
    default:
      return null;
  }
};

export type PopupViewModelInput = {
  pageStatus: StatusEnum;
  optimisticTaskStatus: StatusEnum.Downloading | null;
  activeTask: ActiveDownloadTask | null;
  galleryUrl: string;
  range: [number, number];
  downloadCount: number;
};

export const derivePopupViewModel = ({
  pageStatus,
  optimisticTaskStatus,
  activeTask,
  galleryUrl,
  range,
  downloadCount,
}: PopupViewModelInput) => {
  const currentTask = activeTask?.galleryUrl === galleryUrl ? activeTask : null;
  const taskStatus = currentTask ? taskStatusToUi(currentTask.status) : null;
  const status =
    pageStatus === StatusEnum.BeforeDownload
      ? taskStatus ?? optimisticTaskStatus ?? pageStatus
      : pageStatus;
  const isTerminalDownload =
    status === StatusEnum.DownloadSuccess ||
    status === StatusEnum.DownloadPartialSuccess ||
    status === StatusEnum.DownloadFailed;
  const isAnyTaskActive =
    activeTask?.status === 'running' || activeTask?.status === 'dispatch_complete';

  return {
    status,
    isTaskForCurrentGallery: Boolean(currentTask),
    isCenteredStatus: (CENTERED_STATUSES as readonly StatusEnum[]).includes(status),
    isTerminalDownload,
    isSelfScrollingLayout:
      status === StatusEnum.BeforeDownload ||
      status === StatusEnum.Downloading ||
      isTerminalDownload,
    isDownloading: status === StatusEnum.Downloading || isAnyTaskActive,
    progressRange: currentTask
      ? { start: currentTask.rangeStart, end: currentTask.rangeEnd }
      : { start: range[0], end: range[1] },
    progressTotal: currentTask ? currentTask.expectedCount : downloadCount,
    taskDisplayRange: currentTask
      ? ([currentTask.rangeStart, currentTask.rangeEnd] as [number, number])
      : range,
    taskDisplayTotal: currentTask ? currentTask.expectedCount : downloadCount,
  };
};
