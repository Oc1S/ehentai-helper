import '../styles/index.css';
import '../styles/popup.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Link, Progress, Spinner, Tab, Tabs } from '@nextui-org/react';
import axios from 'axios';

import { AppShell } from '@/app';
import { DownloadIcon } from '@/components/icons/DownloadIcon';
import { PageSelector } from '@/components/page-selector';
import { StatusCard } from '@/components/status-card';
import {
  defaultConfig,
  getCurrentTabUrl,
  isEHentaiGalleryUrl,
  isEHentaiPageUrl,
  useMounted,
  useStateRef,
  useStorage,
  useStorageSuspense,
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
  isGalleryPageHtml,
  removeInvalidCharFromFilename,
} from '@/utils';

import { History } from '../components/download-history';
import { DownloadSettings } from '../components/download-settings';
import { DownloadTable } from '../components/Table';
import { CheckIcon, CloseIcon, InfoIcon, LinkIcon } from './components/icons';
import { CENTERED_STATUSES, StatusEnum } from './status';

const DownloadProgress = ({
  downloadCount,
  finishedCount,
}: {
  downloadCount: number;
  finishedCount: number;
}) => (
  <div className="w-full space-y-4">
    <div className="flex items-end justify-between">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">Progress</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-accent">
          {downloadCount > 0 ? Math.round((finishedCount / downloadCount) * 100) : 0}%
        </p>
      </div>
      <div className="text-right">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">Completed</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
          {finishedCount}
          <span className="text-sm font-medium text-muted"> / {downloadCount}</span>
        </p>
      </div>
    </div>
    <Progress
      aria-label="Download progress"
      value={finishedCount}
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
      {Math.max(0, downloadCount - finishedCount)} images remaining
    </p>
  </div>
);

let galleryInfo: GalleryInfo;

const sendRuntimeMessage = (message: Record<string, unknown>) =>
  new Promise<void>((resolve) => {
    chrome.runtime.sendMessage(message, () => resolve());
  });

const Popup = () => {
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
        if (!isGalleryPageHtml(galleryHtmlStr)) {
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
  const finishedCount = finishedList.length;

  const statusContent = (() => {
    switch (status) {
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
            <div className="flex items-center justify-center gap-2 text-sm leading-relaxed text-body">
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
      case StatusEnum.Fail:
        return (
          <StatusCard
            variant="error"
            icon={<CloseIcon />}
            title="Connection Failed"
            description="Unable to fetch data from server. Please try again later."
          />
        );
      case StatusEnum.BeforeDownload:
        return (
          <div className="scrollbar-glass flex h-full w-full flex-col gap-3 overflow-y-auto px-4 py-4 pb-6">
            {/* Gallery Info Widget - Bento Style */}
            <div className="glass-panel group relative flex min-h-[100px] flex-col justify-end overflow-hidden rounded-[20px] p-4">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-accent/10 blur-[80px] transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/[0.04] to-transparent" />

              <div className="relative z-10 flex flex-col gap-2.5">
                <h2
                  className="line-clamp-2 text-[16px] font-bold leading-tight tracking-tight text-ink"
                  title={galleryTitle}
                >
                  {galleryTitle}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-full border border-hairline-soft bg-brand-accent/[0.04] px-2.5 py-1 text-[11px] font-medium text-muted backdrop-blur-md">
                    <div className="shadow-glow-dot h-1.5 w-1.5 rounded-full bg-brand-accent" />
                    {galleryPageInfo.totalImages} Images
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-hairline-soft bg-brand-accent/[0.04] px-2.5 py-1 text-[11px] font-medium text-muted backdrop-blur-md">
                    <div className="shadow-glow-dot-soft h-1.5 w-1.5 rounded-full bg-brand-accent/70" />
                    {galleryPageInfo.numPages} Pages
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Range Selector Widget */}
              {range[1] > 0 && (
                <div className="glass-panel col-span-3 flex flex-col gap-1.5 rounded-[16px] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold tracking-tight text-ink">
                      Download Range
                    </span>
                    <span className="flex h-5 items-center justify-center rounded-full border border-brand-accent/20 bg-brand-accent/[0.08] px-2 font-mono text-[11px] font-bold text-brand-accent">
                      {range[0]} - {range[1]}
                    </span>
                  </div>
                  <div className="px-1 pb-1">
                    <PageSelector
                      range={range}
                      setRange={setRange}
                      maxValue={galleryPageInfo.totalImages}
                    />
                  </div>
                </div>
              )}

              {/* Selected Count Widget */}
              <div className="col-span-1 flex flex-col items-center justify-center overflow-hidden rounded-[16px] border border-brand-accent/20 bg-brand-accent/[0.03] p-3 text-center shadow-inner">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-soft">
                  Selected
                </span>
                <span className="mt-0.5 font-mono text-2xl font-black tracking-tighter text-brand-accent">
                  {downloadCount}
                </span>
              </div>

              {/* Action Button Widget */}
              <Button
                type="button"
                variant="flat"
                className="group relative col-span-2 flex h-full min-h-[72px] flex-row items-center justify-center gap-3 overflow-hidden rounded-[16px] border border-brand-accent/30 bg-brand-accent/15 px-5 py-3 shadow-glow transition-transform hover:bg-brand-accent/25 active:scale-95"
                onPress={handleClickDownload}
                disableRipple
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent/20 text-brand-accent">
                  <DownloadIcon />
                </div>
                <span className="text-sm font-bold tracking-wide text-brand-accent">
                  Start Download
                </span>
              </Button>
            </div>
          </div>
        );
      case StatusEnum.Downloading:
        return (
          <div className="scrollbar-glass flex h-full w-full flex-col gap-3 overflow-y-auto px-4 py-4 pb-6">
            <div className="glass-panel relative flex flex-col justify-end overflow-hidden rounded-[20px] p-5">
              <div className="absolute -right-20 -top-20 h-64 w-64 animate-pulse rounded-full bg-brand-accent/10 blur-[80px]" />
              <div className="relative z-10">
                <h3 className="line-clamp-2 text-[15px] font-bold leading-tight tracking-tight text-ink">
                  {galleryTitle}
                </h3>
                <div className="mt-2.5 flex items-center gap-2">
                  <Spinner size="sm" color="primary" />
                  <span className="text-[13px] font-medium text-brand-accent">
                    Downloading images...
                  </span>
                </div>
              </div>
            </div>
            <div className="glass-panel flex flex-col gap-3 rounded-[20px] p-5">
              <DownloadProgress downloadCount={downloadCount} finishedCount={finishedCount} />
            </div>
          </div>
        );
      case StatusEnum.DownloadSuccess:
        return (
          <div className="scrollbar-glass flex h-full w-full flex-col gap-3 overflow-y-auto px-4 py-4 pb-6">
            <div className="glass-panel flex flex-col gap-3 rounded-[20px] p-5">
              <div className="text-left">
                <h3 className="line-clamp-2 text-[15px] font-bold leading-tight tracking-tight text-ink">
                  {galleryTitle}
                </h3>
                <p className="mt-1.5 text-[12px] font-medium text-muted">
                  All images downloaded successfully
                </p>
              </div>
              <StatusCard
                embedded
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
              />
            </div>
            <div className="glass-panel flex flex-col gap-3 rounded-[20px] p-5">
              <DownloadProgress downloadCount={downloadCount} finishedCount={finishedCount} />
            </div>
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <AppShell>
      <div className="flex h-popup w-popup flex-col overflow-hidden bg-canvas">
        <header className="flex h-popup-header shrink-0 items-center justify-between border-b border-hairline bg-surface-dark px-5">
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
                  {statusContent}
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

export default Popup;
