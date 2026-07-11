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

const formatTargetIndicesLabel = (task: ActiveDownloadTask | null) => {
  const indices = task?.targetIndices?.length
    ? [...new Set(task.targetIndices)].sort((a, b) => a - b)
    : null;
  if (!indices || indices.length === 0) return undefined;

  const first = indices[0];
  const last = indices[indices.length - 1];
  const coversTaskRange =
    first === task?.rangeStart && last === task.rangeEnd && indices.length === last - first + 1;
  if (coversTaskRange) return undefined;
  if (indices.length === 1) return String(first);
  if (indices.length === last - first + 1) return `${first} - ${last}`;
  if (indices.length <= 3) return indices.join(', ');
  return `${first}, ... ${last}`;
};

export type PopupViewModelInput = {
  pageStatus: StatusEnum;
  optimisticTaskStatus: StatusEnum.Downloading | null;
  dismissResult: boolean;
  activeTask: ActiveDownloadTask | null;
  galleryUrl: string;
  range: [number, number];
  downloadCount: number;
};

export const derivePopupViewModel = ({
  pageStatus,
  optimisticTaskStatus,
  dismissResult,
  activeTask,
  galleryUrl,
  range,
  downloadCount,
}: PopupViewModelInput) => {
  const currentTask = activeTask?.galleryUrl === galleryUrl ? activeTask : null;
  const taskStatus = currentTask ? taskStatusToUi(currentTask.status) : null;
  // 用户点「返回下载范围」后忽略终态 task，直到新下载开始或 task 被清空
  const status = dismissResult
    ? StatusEnum.BeforeDownload
    : pageStatus === StatusEnum.BeforeDownload
      ? taskStatus ?? optimisticTaskStatus ?? pageStatus
      : pageStatus;
  const isTerminalDownload =
    status === StatusEnum.DownloadSuccess ||
    status === StatusEnum.DownloadPartialSuccess ||
    status === StatusEnum.DownloadFailed;
  const isAnyTaskActive =
    activeTask?.status === 'running' || activeTask?.status === 'dispatch_complete';
  const taskDisplayRangeLabel = formatTargetIndicesLabel(currentTask);

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
    taskDisplayRangeLabel,
    taskDisplayTotal: currentTask ? currentTask.expectedCount : downloadCount,
  };
};
