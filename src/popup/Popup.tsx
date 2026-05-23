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
            <div className="loading-state">
              <Spinner size="lg" color="primary" />
              <p className="caption animate-pulse">Initializing...</p>
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
                <Link href="https://e-hentai.org/" isExternal className="text-link">
                  E-Hentai
                </Link>
                <span className="caption-soft">or</span>
                <Link href="https://exhentai.org/" isExternal className="text-link">
                  ExHentai
                </Link>
              </div>
            </StatusCard>
          );
        case StatusEnum.BeforeDownload:
          return (
            <div className="download-layout">
              <div className="gallery-hero">
                <h2 className="title-md line-clamp-2" title={galleryTitle}>
                  {galleryTitle}
                </h2>
                <p className="caption mt-1">{galleryPageInfo.totalImages} images found</p>
              </div>
              <div className="feature-card flex flex-col gap-4">
                {range[1] > 0 && (
                  <div>
                    <div className="popup-range-header">
                      <label className="caption">Range</label>
                      <span className="caption-soft">
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
                  <div className="stat-row">
                    <span className="caption">Selected</span>
                    <div className="flex items-baseline gap-1">
                      <span className="progress-count">{downloadCount}</span>
                      <span className="caption-soft">images</span>
                    </div>
                  </div>
                  <button type="button" className="btn-primary" onClick={handleClickDownload}>
                    <DownloadIcon />
                    Start Download
                  </button>
                </div>
              </div>
            </div>
          );
        case StatusEnum.Downloading:
          return (
            <div className="download-layout">
              <div className="gallery-hero">
                <h3 className="title-sm line-clamp-2">{galleryTitle}</h3>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <Spinner size="sm" color="primary" />
                  <span className="caption">Downloading...</span>
                </div>
              </div>
              <div className="product-panel w-full">{renders.progress()}</div>
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
                    className="text-link"
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
        <div className="progress-meta">
          <span className="caption">Progress</span>
          <div className="flex items-center gap-1.5">
            <span className="progress-count">{finishedList.length}</span>
            <span className="caption-soft">/</span>
            <span className="progress-total">{downloadCount}</span>
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
        <div className="caption-soft flex justify-between">
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
      <div className="popup-shell">
        <header className="popup-header">
          <span className="popup-header__title">E-Hentai Helper</span>
          <DownloadSettings />
        </header>
        <div className="popup-body">
          <Tabs aria-label="popup tabs" className="popup-tabs">
            <Tab key="info" title="Info">
              <div
                className={`popup-tab-scroll scrollbar-glass ${isCenteredStatus ? 'popup-tab-scroll--center' : ''}`}
              >
                {status === StatusEnum.Loading && renders.status()}
                {isCenteredStatus && renders.status()}
                {status === StatusEnum.DownloadSuccess && (
                  <div className="state-stack">
                    <div className="gallery-hero w-full">
                      <h3 className="title-sm line-clamp-2">{galleryTitle}</h3>
                      <p className="caption mt-1">All images downloaded successfully</p>
                    </div>
                    {renders.status()}
                    <div className="product-panel w-full">{renders.progress()}</div>
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
    <div className="popup-shell loading-state">
      <p className="caption">Loading...</p>
    </div>
  ),
  <div className="popup-shell loading-state">
    <p className="status-desc">Something went wrong</p>
  </div>
);
