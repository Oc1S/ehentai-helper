import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Progress, Spinner, Tab, Tabs } from '@nextui-org/react';
import axios from 'axios';

import { AppShell } from '@/app';
import {
  defaultConfig,
  getCurrentTabUrl,
  isEHentaiGalleryUrl,
  isEHentaiPageUrl,
  useMounted,
  useStateRef,
  useStorage,
  useStorageSuspense,
  withErrorBoundary,
  withSuspense,
} from '@/shared';
import {
  configStorage,
  downloadHistoryStorage,
  downloadIndexMapStorage,
  downloadListStorage,
  type GalleryInfo,
} from '@/storage';
import {
  downloadAsTxtFile,
  extractGalleryInfo,
  extractGalleryPageInfo,
  htmlStr2DOM,
  removeInvalidCharFromFilename,
} from '@/utils';

import { DownloadSettings } from './components/DownloadSettings';
import { History } from './components/History';
import { DownloadIcon } from './components/icons/DownloadIcon';
import { PageSelector } from './components/PageSelector';
import { StatusCard } from './components/StatusCard';
import { DownloadTable } from './components/Table';

enum StatusEnum {
  Loading = 0,
  OtherPage = 1,
  EHentaiOther = 2,
  Fail = 3,
  BeforeDownload = 4,
  Downloading = 5,
  DownloadSuccess = 6,
}

let galleryInfo: GalleryInfo;

const sendRuntimeMessage = (message: Record<string, unknown>) =>
  new Promise<void>((resolve) => {
    chrome.runtime.sendMessage(message, () => resolve());
  });

const InfoIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const LinkIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PopupLayout = () => {
  const [status, setStatus] = useState<StatusEnum>(StatusEnum.Loading);
  const config = useStorage(configStorage);
  const storedDownloadList = useStorageSuspense(downloadListStorage) || [];
  const downloadIndexMap = useStorageSuspense(downloadIndexMapStorage) || {};
  const galleryFrontPageUrl = useRef('');
  const configRef = useRef(defaultConfig);
  const [galleryPageInfo, setGalleryPageInfo, galleryPageInfoRef] = useStateRef({
    imagesPerPage: 0,
    numPages: 0,
    totalImages: 0,
  });
  const [range, setRange] = useState<[number, number]>([1, galleryPageInfo.totalImages]);
  const [galleryTitle, setGalleryTitle] = useState('');

  useEffect(() => {
    if (config) {
      configRef.current = config;
    }
  }, [config]);

  useEffect(() => {
    setRange([1, galleryPageInfo.totalImages]);
  }, [galleryPageInfo.totalImages]);

  const [startIndex, endIndex] = range;
  const [start, end] = useMemo(() => {
    const start = {
      indexOfPage: (startIndex - 1) % galleryPageInfo.imagesPerPage,
      page: Math.floor((startIndex - 1) / galleryPageInfo.imagesPerPage),
    };
    const end = {
      indexOfPage: (endIndex - 1) % galleryPageInfo.imagesPerPage,
      page: Math.floor((endIndex - 1) / galleryPageInfo.imagesPerPage),
    };
    return [start, end];
  }, [galleryPageInfo.imagesPerPage, startIndex, endIndex]);

  const downloadCount = range[1] - range[0] + 1;
  const trackedDownloadIdSet = useMemo(() => {
    const currentDownloadPath = configRef.current.intermediateDownloadPath;
    return new Set(
      Object.entries(downloadIndexMap)
        .filter(([, entry]) => entry.downloadPath === currentDownloadPath)
        .map(([id]) => Number(id))
    );
  }, [downloadIndexMap]);
  const progressDownloadList = storedDownloadList.filter((item) =>
    trackedDownloadIdSet.has(item.id)
  );
  const finishedList = progressDownloadList.filter((item) => item.state === 'complete');

  const downloadJob = {
    processGalleryPage: async (pageIndex: number) => {
      if (pageIndex < start.page || pageIndex > end.page) return;
      const pageUrl = `${galleryFrontPageUrl.current}?p=${pageIndex}`;
      const { data: pageHtml } = await axios.get(pageUrl);
      const imagePageUrls = downloadJob.extractImagePageUrls(pageHtml);
      if (imagePageUrls.length === 0) return;
      downloadJob.downloadImage(imagePageUrls[0], pageIndex, 0);
      let imageIndex = 1;
      const imageInterval = setInterval(() => {
        if (imageIndex === imagePageUrls.length) {
          clearInterval(imageInterval);
          return;
        }
        downloadJob.downloadImage(imagePageUrls[imageIndex], pageIndex, imageIndex);
        imageIndex++;
      }, configRef.current.downloadInterval);
      return imagePageUrls.length;
    },
    extractImagePageUrls: (html: string) => {
      const doc = htmlStr2DOM(html);
      return Array.from(doc.getElementById('gdt')?.childNodes || []).map(
        (n) => (n as HTMLAnchorElement).href
      );
    },
    downloadImage: async (url: string, pageIndex: number, imageIndex: number) => {
      const currentIndex = pageIndex * galleryPageInfo.imagesPerPage + imageIndex + 1;
      if (currentIndex < startIndex || currentIndex > endIndex) return;
      const res = await axios.get(url);
      const responseText = res.data;
      const doc = htmlStr2DOM(responseText);
      let imageUrl = (doc.getElementById('img') as HTMLImageElement).src;
      if (configRef.current.saveOriginalImages) {
        try {
          const originalImage = (
            doc.getElementById('i6')?.childNodes?.[3] as HTMLDivElement
          )?.getElementsByTagName('a')[0].href;
          imageUrl = originalImage || imageUrl;
        } catch (e) {
          console.log('get original image failed@', e);
        }
      }
      chrome.downloads.download({ url: imageUrl }, (id) => {
        if (typeof id !== 'number') return;
        void chrome.runtime.sendMessage({
          type: 'register-download-index',
          id,
          index: currentIndex,
          total: galleryPageInfoRef.current.totalImages,
          downloadPath: configRef.current.intermediateDownloadPath,
        });
      });
    },
    downloadAllImages: () => {
      let pageIndex = start.page;
      downloadJob.processGalleryPage(pageIndex);
      pageIndex++;
      const pageInterval = setInterval(() => {
        if (pageIndex === galleryPageInfo.numPages) {
          clearInterval(pageInterval);
          return;
        }
        downloadJob.processGalleryPage(pageIndex);
        pageIndex++;
      }, configRef.current.downloadInterval * galleryPageInfo.imagesPerPage);
    },
  };

  useEffect(() => {
    if (
      status === StatusEnum.Downloading &&
      downloadCount > 0 &&
      downloadCount === finishedList.length
    ) {
      setStatus(StatusEnum.DownloadSuccess);
    }
  }, [status, downloadCount, finishedList.length]);

  useMounted(() => {
    (async () => {
      const url = await getCurrentTabUrl().catch(() => '');
      if (isEHentaiGalleryUrl(url)) {
        const items = configRef.current ?? defaultConfig;
        configRef.current = items;
        galleryFrontPageUrl.current = url.substring(0, url.lastIndexOf('/') + 1);
        const { data: galleryHtmlStr } = await axios
          .get(galleryFrontPageUrl.current)
          .catch(() => ({ data: '' }));
        if (!galleryHtmlStr) {
          setStatus(StatusEnum.Fail);
          return;
        }
        const pageInfo = extractGalleryPageInfo(galleryHtmlStr);
        setGalleryPageInfo(pageInfo);
        galleryInfo = await extractGalleryInfo(galleryHtmlStr);
        setGalleryTitle(galleryInfo.name);
        configRef.current = {
          ...configRef.current,
          intermediateDownloadPath:
            configRef.current.intermediateDownloadPath +
            removeInvalidCharFromFilename(galleryInfo.name),
        };
        setStatus(StatusEnum.BeforeDownload);
        return;
      }
      if (isEHentaiPageUrl(url)) {
        setStatus(StatusEnum.EHentaiOther);
        return;
      }
      setStatus(StatusEnum.OtherPage);
    })();
  });

  const handleClickDownload = async () => {
    try {
      await downloadHistoryStorage.add({
        url: galleryFrontPageUrl.current,
        name: galleryInfo.name,
        range,
        info: galleryInfo,
      });
    } catch (e) {
      console.error('add download history failed@', e);
    }
    setStatus(StatusEnum.Downloading);
    await sendRuntimeMessage({
      type: 'clear-download-index-map',
    });
    await sendRuntimeMessage({
      type: 'set-download-context',
      downloadPath: configRef.current.intermediateDownloadPath,
      total: galleryPageInfoRef.current.totalImages,
    });
    downloadJob.downloadAllImages();
    if (configRef.current.saveGalleryInfo) {
      downloadAsTxtFile(JSON.stringify(galleryInfo, null, 2));
    }
  };

  const renders = {
    status: () => {
      switch (status) {
        default:
        case StatusEnum.Loading:
          return (
            <div className="flex h-popup-content flex-col items-center justify-center gap-3">
              <Spinner size="lg" color="primary" />
              <p className="animate-pulse text-[13px] font-medium text-muted">Initializing...</p>
            </div>
          );
        case StatusEnum.EHentaiOther:
          return (
            <StatusCard
              variant="warning"
              icon={<InfoIcon />}
              title="Non-gallery Page Detected"
              description="Navigate to a gallery page to start downloading"
            />
          );
        case StatusEnum.OtherPage:
          return (
            <StatusCard
              variant="info"
              icon={<LinkIcon />}
              title="Navigate to Gallery"
              description="Visit a gallery page to start downloading"
            >
              <div className="body-sm flex items-center justify-center gap-2">
                <span>Go to</span>
                <Link
                  href="https://e-hentai.org/"
                  isExternal
                  className="text-[13px] font-medium text-ink underline underline-offset-2"
                >
                  E-Hentai
                </Link>
                <span className="text-[11px] text-muted-soft">or</span>
                <Link
                  href="https://exhentai.org/"
                  isExternal
                  className="text-[13px] font-medium text-ink underline underline-offset-2"
                >
                  ExHentai
                </Link>
              </div>
            </StatusCard>
          );
        case StatusEnum.BeforeDownload:
          return (
            <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
              <div className="px-2 pb-1 text-center">
                <h2
                  className="line-clamp-2 text-[17px] font-semibold leading-[1.35] text-ink"
                  title={galleryTitle}
                >
                  {galleryTitle}
                </h2>
                <p className="mt-1 text-[13px] font-medium text-muted">
                  {galleryPageInfo.totalImages} images found
                </p>
              </div>
              <div className="flex flex-col gap-4 rounded-cal-lg border border-hairline bg-surface-card p-4 shadow-card">
                {range[1] > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-[13px] font-medium text-muted">Range</label>
                      <span className="text-[11px] text-muted-soft">
                        {range[0]} – {range[1]}
                      </span>
                    </div>
                    <PageSelector
                      range={range}
                      setRange={setRange}
                      maxValue={galleryPageInfo.totalImages}
                    />
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between rounded-[10px] border border-hairline bg-surface-soft px-3.5 py-2.5">
                    <span className="text-[13px] font-medium text-muted">Selected</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-semibold text-ink">{downloadCount}</span>
                      <span className="text-[11px] text-muted-soft">images</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-primary text-[13px]"
                    onClick={handleClickDownload}
                  >
                    <DownloadIcon />
                    Start Download
                  </button>
                </div>
              </div>
            </div>
          );
        case StatusEnum.Downloading:
          return (
            <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
              <div className="px-2 pb-1 text-center">
                <h3 className="line-clamp-2 text-[15px] font-semibold text-ink">{galleryTitle}</h3>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <Spinner size="sm" color="primary" />
                  <span className="text-[13px] font-medium text-muted">Downloading...</span>
                </div>
              </div>
              <div className="w-full rounded-cal-lg border border-hairline bg-surface-soft p-4 shadow-card">
                {renders.progress()}
              </div>
            </div>
          );
        case StatusEnum.DownloadSuccess:
          return (
            <StatusCard
              variant="success"
              icon={<CheckIcon />}
              title="Download Completed!"
              description={
                <>
                  Enjoying the extension?{' '}
                  <Link
                    href="https://github.com/Oc1S/ehentai-helper"
                    isExternal
                    className="text-[13px] font-medium text-ink underline underline-offset-2"
                  >
                    Star it on GitHub
                  </Link>
                </>
              }
            />
          );
        case StatusEnum.Fail:
          return (
            <StatusCard
              variant="error"
              icon={<CloseIcon />}
              title="Connection Failed"
              description="Unable to fetch data from server. Please try again later."
            />
          );
      }
    },
    progress: () => (
      <div className="w-full space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[13px] font-medium text-muted">Progress</span>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-semibold text-ink">{finishedList.length}</span>
            <span className="text-[11px] text-muted-soft">/</span>
            <span className="text-base font-medium text-muted">{downloadCount}</span>
          </div>
        </div>
        <Progress
          aria-label="Download progress"
          value={finishedList.length}
          minValue={0}
          maxValue={downloadCount}
          className="w-full"
          color="primary"
          size="sm"
        />
        <div className="flex justify-between text-[11px] text-muted-soft">
          <span>
            {downloadCount > 0
              ? `${Math.round((finishedList.length / downloadCount) * 100)}% complete`
              : '0% complete'}
          </span>
          <span>{Math.max(0, downloadCount - finishedList.length)} remaining</span>
        </div>
      </div>
    ),
  };

  const isCenteredStatus = [
    StatusEnum.OtherPage,
    StatusEnum.EHentaiOther,
    StatusEnum.Fail,
  ].includes(status);

  return (
    <AppShell>
      <div className="flex h-popup w-popup flex-col overflow-hidden bg-canvas">
        <header className="flex h-popup-header shrink-0 items-center justify-between border-b border-hairline-soft px-5">
          <span className="text-[15px] font-semibold tracking-tight text-ink">E-Hentai Helper</span>
          <DownloadSettings />
        </header>
        <div className="flex min-h-0 flex-1 flex-col items-center px-4 pb-4 pt-3">
          <Tabs aria-label="popup tabs">
            <Tab key="info" title="Info">
              <div
                className={`scrollbar-glass h-popup-content overflow-y-auto overflow-x-hidden ${isCenteredStatus ? 'flex items-center justify-center px-1 py-2' : ''}`}
              >
                {status === StatusEnum.Loading && renders.status()}
                {isCenteredStatus && renders.status()}
                {status === StatusEnum.DownloadSuccess && (
                  <div className="flex flex-col items-center gap-4 px-1 py-2 pb-3">
                    <div className="w-full px-2 pb-1 text-center">
                      <h3 className="line-clamp-2 text-[15px] font-semibold text-ink">
                        {galleryTitle}
                      </h3>
                      <p className="mt-1 text-[13px] font-medium text-muted">
                        All images downloaded successfully
                      </p>
                    </div>
                    {renders.status()}
                    <div className="w-full rounded-cal-lg border border-hairline bg-surface-soft p-4 shadow-card">
                      {renders.progress()}
                    </div>
                  </div>
                )}
                {status === StatusEnum.BeforeDownload && renders.status()}
                {status === StatusEnum.Downloading && renders.status()}
              </div>
            </Tab>
            <Tab key="downloadList" title="Downloads">
              <DownloadTable />
            </Tab>
            <Tab key="history" title="History">
              <History />
            </Tab>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
};

export default withErrorBoundary(
  withSuspense(
    PopupLayout,
    <div className="flex h-popup w-popup flex-col items-center justify-center gap-3 overflow-hidden bg-canvas">
      <p className="text-[13px] font-medium text-muted">Loading...</p>
    </div>
  ),
  <div className="flex h-popup w-popup flex-col items-center justify-center gap-3 overflow-hidden bg-canvas">
    <p className="text-xs leading-relaxed text-muted">Something went wrong</p>
  </div>
);
