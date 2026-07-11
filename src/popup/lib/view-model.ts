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

/**
 * 当图片进度已全部 settle，但 task.status 仍滞后于 running/dispatch_complete 时，
 * 用进度直接推导终态，避免「下载中 1/1 → 成功页」闪烁。
 */
const statusFromSettledProgress = (
  expected: number,
  complete: number,
  failed: number
): StatusEnum | null => {
  if (expected <= 0) return null;
  const settled = complete + failed;
  if (settled < expected) return null;
  if (complete === expected) return StatusEnum.DownloadSuccess;
  if (complete === 0) return StatusEnum.DownloadFailed;
  return StatusEnum.DownloadPartialSuccess;
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
  progressComplete: number;
  progressFailed: number;
};

export const derivePopupViewModel = ({
  pageStatus,
  optimisticTaskStatus,
  dismissResult,
  activeTask,
  galleryUrl,
  range,
  downloadCount,
  progressComplete,
  progressFailed,
}: PopupViewModelInput) => {
  const currentTask = activeTask?.galleryUrl === galleryUrl ? activeTask : null;
  const taskStatus = currentTask ? taskStatusToUi(currentTask.status) : null;

  const progressStatus =
    currentTask &&
    (currentTask.status === 'running' || currentTask.status === 'dispatch_complete')
      ? statusFromSettledProgress(
          currentTask.expectedCount,
          progressComplete,
          progressFailed
        )
      : null;

  // 优先级：用户关闭结果页 > 进度已 settle 的终态 > task 状态 > 乐观下载中 > pageStatus
  const status = dismissResult
    ? StatusEnum.BeforeDownload
    : pageStatus === StatusEnum.BeforeDownload
      ? progressStatus ?? taskStatus ?? optimisticTaskStatus ?? pageStatus
      : pageStatus;

  const isTerminalDownload =
    status === StatusEnum.DownloadSuccess ||
    status === StatusEnum.DownloadPartialSuccess ||
    status === StatusEnum.DownloadFailed;
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
    // 以派生 UI 状态为准，避免 task 仍 running 但已显示成功时 isDownloading 仍为 true
    isDownloading: status === StatusEnum.Downloading,
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
