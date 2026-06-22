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
  rangeEnd: number
) => {
  if (!record) return [];
  return Object.values(record.images)
    .filter((img) => img.state === 'interrupted' && img.index >= rangeStart && img.index <= rangeEnd)
    .map((img) => img.index)
    .sort((a, b) => a - b);
};

export const estimateDownloadSeconds = (count: number, intervalMs: number) =>
  Math.max(1, Math.ceil((count * Math.max(0, intervalMs)) / 1000));
