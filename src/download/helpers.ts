import type { GalleryRecord } from '@/storage';

export const rangeIndices = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, i) => start + i);

export const computeMissingIndices = (
  record: GalleryRecord | undefined,
  rangeStart: number,
  rangeEnd: number
) => {
  const missing: number[] = [];
  for (let i = rangeStart; i <= rangeEnd; i++) {
    const img = record?.images[String(i)];
    if (!img || img.state !== 'complete') missing.push(i);
  }
  return missing;
};

export const computeFailedIndices = (
  record: GalleryRecord | undefined,
  rangeStart: number,
  rangeEnd: number,
  options: { taskId?: string; indices?: number[] } = {}
) => {
  if (!record) return [];
  const indexSet = options.indices?.length ? new Set(options.indices) : null;
  return Object.values(record.images)
    .filter((img) => {
      if (img.state !== 'interrupted') return false;
      if (options.taskId && img.taskId !== options.taskId) return false;
      if (indexSet) return indexSet.has(img.index);
      return img.index >= rangeStart && img.index <= rangeEnd;
    })
    .map((img) => img.index)
    .sort((a, b) => a - b);
};

export const computeUnfinishedIndices = (
  record: GalleryRecord | undefined,
  rangeStart: number,
  rangeEnd: number,
  options: { taskId?: string; indices?: number[] } = {}
) => {
  const indices = options.indices?.length
    ? [...new Set(options.indices)].sort((a, b) => a - b)
    : rangeIndices(rangeStart, rangeEnd);

  return indices.filter((index) => {
    const img = record?.images[String(index)];
    if (!img) return true;
    if (options.taskId && img.taskId && img.taskId !== options.taskId) return true;
    return img.state !== 'complete';
  });
};

export const estimateDownloadSeconds = (count: number, intervalMs: number) =>
  Math.max(1, Math.ceil((count * Math.max(0, intervalMs)) / 1000));
