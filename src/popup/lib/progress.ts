export const countRangeProgress = (
  record: { images: Record<string, { state: string; taskId?: string }> } | undefined,
  rangeStart: number,
  rangeEnd: number,
  taskId?: string
) => {
  let completeCount = 0;
  let failedCount = 0;
  let inProgressCount = 0;
  if (!record) return { completeCount, failedCount, inProgressCount };

  for (let i = rangeStart; i <= rangeEnd; i++) {
    const img = record.images[String(i)];
    if (!img) continue;
    if (taskId && img.taskId !== taskId) continue;
    if (img.state === 'complete') completeCount++;
    else if (img.state === 'interrupted') failedCount++;
    else if (img.state === 'in_progress') inProgressCount++;
  }
  return { completeCount, failedCount, inProgressCount };
};

export const countIndicesProgress = (
  record: { images: Record<string, { state: string; taskId?: string }> } | undefined,
  indices: number[],
  taskId?: string
) => {
  let completeCount = 0;
  let failedCount = 0;
  let inProgressCount = 0;
  for (const i of indices) {
    const img = record?.images[String(i)];
    if (!img) continue;
    if (taskId && img.taskId !== taskId) continue;
    if (img.state === 'complete') completeCount++;
    else if (img.state === 'interrupted') failedCount++;
    else if (img.state === 'in_progress') inProgressCount++;
  }
  return { completeCount, failedCount, inProgressCount };
};
