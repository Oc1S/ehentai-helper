import { clearCbzTask, listCbzImages } from '@/download/cbz-cache';
import { consumePendingCbzFilename, setPendingCbzFilename } from '@/download/cbz-download';
import { normalizeDownloadDir } from '@/download/download-filename';
import { zipStore } from '@/download/zip-store';
import { type ActiveDownloadTask, galleryRecordsStorage } from '@/storage';
import type { Config } from '@/utils';
import { removeInvalidCharFromFilename } from '@/utils';
import { createDownloadUrl, releaseDownloadUrlOnDownloadDone } from '@/utils/blob-download-url';
import { buildImageEntryName } from '@/utils/filename-rule';
import { resolveImageBlob } from '@/utils/image-blob';

const blobToBytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

export const packAndDownloadCbz = async (
  task: ActiveDownloadTask,
  config: Config,
  completeIndices: number[]
): Promise<boolean> => {
  if (completeIndices.length === 0) return false;

  const cached = await listCbzImages(task.taskId);
  const cacheByIndex = new Map(cached.map((row) => [row.index, row]));
  const records = await galleryRecordsStorage.get();
  const gallery = records?.[task.galleryUrl];

  const zipFiles: Record<string, Uint8Array> = {};

  for (const index of completeIndices) {
    const cachedRow = cacheByIndex.get(index);
    const record = gallery?.images[String(index)];
    let bytes: Uint8Array;
    let ext: string;
    let sourceUrl: string;

    if (cachedRow) {
      bytes = await blobToBytes(cachedRow.blob);
      ext = cachedRow.ext;
      sourceUrl = cachedRow.sourceUrl;
    } else if (record?.sourceUrl) {
      try {
        const resolved = await resolveImageBlob(record.sourceUrl, config.imageFormat);
        bytes = await blobToBytes(resolved.blob);
        ext = resolved.ext;
        sourceUrl = record.sourceUrl;
      } catch {
        continue;
      }
    } else {
      continue;
    }

    const entryName = buildImageEntryName(config, index, task.totalImages, sourceUrl, ext);
    zipFiles[entryName] = bytes;
  }

  if (Object.keys(zipFiles).length === 0) return false;

  const archive = zipStore(zipFiles);
  const archiveBuffer = new ArrayBuffer(archive.byteLength);
  new Uint8Array(archiveBuffer).set(archive);
  const blob = new Blob([archiveBuffer], { type: 'application/vnd.comicbook+zip' });
  const { url, revoke } = await createDownloadUrl(blob);
  const cbzName = `${removeInvalidCharFromFilename(task.galleryName)}.cbz`;
  const cbzPath = `${normalizeDownloadDir(task.downloadPath)}${cbzName}`;

  setPendingCbzFilename(cbzPath);

  const ok = await new Promise<boolean>((resolve) => {
    chrome.downloads.download({ url, saveAs: false }, (id) => {
      if (chrome.runtime.lastError || typeof id !== 'number') {
        consumePendingCbzFilename();
        revoke?.();
        resolve(false);
        return;
      }
      releaseDownloadUrlOnDownloadDone(id, revoke);
      const onChanged = (delta: chrome.downloads.DownloadDelta) => {
        if (delta.id !== id) return;
        const next = delta.state?.current;
        if (next === 'complete' || next === 'interrupted') {
          chrome.downloads.onChanged.removeListener(onChanged);
          resolve(next === 'complete');
        }
      };
      chrome.downloads.onChanged.addListener(onChanged);
    });
  });

  await clearCbzTask(task.taskId);
  return ok;
};
