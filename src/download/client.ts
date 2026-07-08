import type { DownloadJobPayload } from './types';

export const sendDownloadMessage = <T = { ok?: boolean }>(
  type: string,
  extra?: Record<string, unknown>
) =>
  new Promise<T>((resolve) => {
    chrome.runtime.sendMessage({ type, ...extra }, (response) => resolve(response as T));
  });

export const startDownload = (payload: DownloadJobPayload) =>
  sendDownloadMessage('start-download', { payload, mode: 'full' });

export const resumeDownload = (payload: DownloadJobPayload) =>
  sendDownloadMessage('resume-download', { payload, mode: 'resume' });

export const retryFailedDownload = (payload: DownloadJobPayload) =>
  sendDownloadMessage('retry-failed', { payload, mode: 'retry' });

export const cancelDownload = () => sendDownloadMessage('cancel-download');

export const clearDownloadTask = () => sendDownloadMessage('clear-download-task');

export const reconcileGallery = (galleryUrl: string) =>
  sendDownloadMessage('reconcile-gallery', { galleryUrl });
