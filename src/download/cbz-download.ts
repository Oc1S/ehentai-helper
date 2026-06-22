let pendingCbzFilename: string | null = null;

export const setPendingCbzFilename = (filename: string) => {
  pendingCbzFilename = filename;
};

export const consumePendingCbzFilename = (): string | null => {
  const next = pendingCbzFilename;
  pendingCbzFilename = null;
  return next;
};
