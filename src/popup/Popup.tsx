import { useEffect, useMemo, useRef, useState } from 'react';
import { Tab, Tabs } from '@nextui-org/react';
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

import { History } from './components/download-history';
import { DownloadSettings } from './components/download-settings';
import { PopupStatusView } from './components/status';
import { DownloadTable } from './components/Table';
import { CENTERED_STATUSES, StatusEnum } from './status';

let galleryInfo: GalleryInfo;

const sendRuntimeMessage = (message: Record<string, unknown>) =>
  new Promise<void>((resolve) => {
    chrome.runtime.sendMessage(message, () => resolve());
  });

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

  const isCenteredStatus = (CENTERED_STATUSES as readonly StatusEnum[]).includes(status);
  const showStatus =
    status === StatusEnum.Loading ||
    isCenteredStatus ||
    status === StatusEnum.DownloadSuccess ||
    status === StatusEnum.BeforeDownload ||
    status === StatusEnum.Downloading;

  return (
    <AppShell>
      <div className="flex h-popup w-popup flex-col overflow-hidden bg-canvas">
        <header className="flex h-popup-header shrink-0 items-center justify-between border-b border-surface-strong bg-surface-dark px-5">
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
                  className={`scrollbar-glass h-popup-content w-full overflow-y-auto overflow-x-hidden ${isCenteredStatus ? 'flex items-center justify-center px-4 py-2' : ''}`}
                >
                  {showStatus && (
                    <PopupStatusView
                      status={status}
                      galleryTitle={galleryTitle}
                      galleryPageInfo={galleryPageInfo}
                      range={range}
                      setRange={setRange}
                      downloadCount={downloadCount}
                      finishedCount={finishedList.length}
                      onDownload={handleClickDownload}
                    />
                  )}
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
