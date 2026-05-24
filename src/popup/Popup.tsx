import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
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

const DOWNLOAD_CARD_WIDTH = 'w-[480px]';

const MetaBadge = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center rounded-full border border-hairline bg-surface-soft px-2.5 py-1 text-[11px] font-medium text-muted">
    {children}
  </span>
);

const DownloadCard = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`flex w-full shrink-0 justify-center px-2 py-4 ${className}`.trim()}>
    <div
      className={`${DOWNLOAD_CARD_WIDTH} shadow-glow shrink-0 overflow-hidden rounded-cal-xl border border-hairline bg-surface-card`}
    >
      {children}
    </div>
  </div>
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
                  className="font-medium text-brand-accent underline underline-offset-2"
                >
                  E-Hentai
                </Link>
                <span className="text-[11px] text-muted-soft">or</span>
                <Link
                  href="https://exhentai.org/"
                  isExternal
                  className="font-medium text-brand-accent underline underline-offset-2"
                >
                  ExHentai
                </Link>
              </div>
            </StatusCard>
          );
        case StatusEnum.BeforeDownload:
          return (
            <DownloadCard>
              <div className="border-b border-hairline-soft bg-surface-soft/70 px-5 py-4">
                <h2
                  className="line-clamp-2 text-[17px] font-semibold leading-snug text-ink"
                  title={galleryTitle}
                >
                  {galleryTitle}
                </h2>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <MetaBadge>{galleryPageInfo.totalImages} images</MetaBadge>
                  <MetaBadge>{galleryPageInfo.numPages} pages</MetaBadge>
                </div>
              </div>

              {range[1] > 0 && (
                <div className="border-b border-hairline-soft px-5 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-soft">
                      Image range
                    </span>
                    <span className="text-xs font-medium text-brand-accent">
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

              <div className="bg-surface-soft/40 px-5 py-4">
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="rounded-cal-md border border-hairline bg-surface-soft px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">
                      Selected
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-accent">
                      {downloadCount}
                    </p>
                  </div>
                  <div className="rounded-cal-md border border-hairline bg-surface-soft px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">
                      Total
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                      {galleryPageInfo.totalImages}
                    </p>
                  </div>
                </div>
                <button type="button" className="btn-primary" onClick={handleClickDownload}>
                  <DownloadIcon />
                  Start Download
                </button>
              </div>
            </DownloadCard>
          );
        case StatusEnum.Downloading:
          return (
            <DownloadCard>
              <div className="border-b border-hairline-soft bg-surface-soft/70 px-5 py-4">
                <h3 className="line-clamp-2 text-[15px] font-semibold text-ink">{galleryTitle}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <Spinner size="sm" color="primary" />
                  <span className="text-[13px] font-medium text-muted">Downloading images...</span>
                </div>
              </div>
              <div className="px-5 py-4">{renders.progress()}</div>
            </DownloadCard>
          );
        case StatusEnum.DownloadSuccess:
          return (
            <DownloadCard className="py-2">
              <div className="border-b border-hairline-soft bg-surface-soft/70 px-5 py-4 text-center">
                <h3 className="line-clamp-2 text-[15px] font-semibold text-ink">{galleryTitle}</h3>
                <p className="mt-1 text-[13px] font-medium text-muted">
                  All images downloaded successfully
                </p>
              </div>
              <div className="px-5 pt-2">
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
                        className="font-medium text-brand-accent underline underline-offset-2"
                      >
                        Star it on GitHub
                      </Link>
                    </>
                  }
                  className="max-w-none border-0 bg-transparent px-0 py-4 shadow-none"
                />
              </div>
              <div className="border-t border-hairline-soft px-5 py-4">{renders.progress()}</div>
            </DownloadCard>
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
      <div className="w-full space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">
              Progress
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-accent">
              {downloadCount > 0 ? Math.round((finishedList.length / downloadCount) * 100) : 0}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">
              Completed
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
              {finishedList.length}
              <span className="text-sm font-medium text-muted"> / {downloadCount}</span>
            </p>
          </div>
        </div>
        <Progress
          aria-label="Download progress"
          value={finishedList.length}
          minValue={0}
          maxValue={downloadCount}
          className="w-full"
          classNames={{
            track: 'h-2 border-s border-primary/20 bg-surface-strong',
            indicator: 'bg-brand-primary',
          }}
          color="primary"
          size="sm"
        />
        <p className="text-center text-[11px] text-muted-soft">
          {Math.max(0, downloadCount - finishedList.length)} images remaining
        </p>
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
        <header className="flex h-popup-header shrink-0 items-center justify-between border-b border-primary/15 bg-surface-soft/30 px-5">
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            E-Hentai <span className="text-brand-accent">Helper</span>
          </span>
          <DownloadSettings />
        </header>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-[720px] flex-col">
            <Tabs
              aria-label="popup tabs"
              className="w-full"
              classNames={{
                base: 'flex justify-center',
              }}
            >
              <Tab key="info" title="Info">
                <div
                  className={`scrollbar-glass h-popup-content w-full overflow-y-auto overflow-x-hidden ${isCenteredStatus ? 'flex items-center justify-center px-1 py-2' : ''}`}
                >
                  {status === StatusEnum.Loading && renders.status()}
                  {isCenteredStatus && renders.status()}
                  {status === StatusEnum.DownloadSuccess && renders.status()}
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
