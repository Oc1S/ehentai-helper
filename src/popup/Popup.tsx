import { Link, Progress, Spinner, Tabs, Tab } from '@nextui-org/react';
import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  withSuspense
} from '@/shared';
import {
  configStorage,
  downloadHistoryStorage,
  downloadIndexMapStorage,
  downloadListStorage,
  type GalleryInfo
} from '@/storage';
import { downloadAsTxtFile, extractGalleryInfo, extractGalleryPageInfo, htmlStr2DOM, removeInvalidCharFromFilename } from '@/utils';

import { DownloadIcon } from './components/icons/DownloadIcon';
import { DownloadSettings } from './components/DownloadSettings';
import { DownloadTable } from './components/Table';
import { History } from './components/History';
import { PageSelector } from './components/PageSelector';

enum StatusEnum {
  Loading = 0,
  OtherPage = 1,
  EHentaiOther = 2,
  Fail = 3,
  BeforeDownload = 4,
  Downloading = 5,
  DownloadSuccess = 6
}

let galleryInfo: GalleryInfo;

const sendRuntimeMessage = (message: Record<string, unknown>) =>
  new Promise<void>(resolve => {
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
    totalImages: 0
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
      page: Math.floor((startIndex - 1) / galleryPageInfo.imagesPerPage)
    };
    const end = {
      indexOfPage: (endIndex - 1) % galleryPageInfo.imagesPerPage,
      page: Math.floor((endIndex - 1) / galleryPageInfo.imagesPerPage)
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
  const progressDownloadList = storedDownloadList.filter(item => trackedDownloadIdSet.has(item.id));
  const finishedList = progressDownloadList.filter(item => item.state === 'complete');

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
      return Array.from(doc.getElementById('gdt')?.childNodes || []).map(n => (n as HTMLAnchorElement).href);
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
          const originalImage = (doc.getElementById('i6')?.childNodes?.[3] as HTMLDivElement)?.getElementsByTagName('a')[0].href;
          imageUrl = originalImage || imageUrl;
        } catch (e) {
          console.log('get original image failed@', e);
        }
      }
      chrome.downloads.download({ url: imageUrl }, id => {
        if (typeof id !== 'number') return;
        void chrome.runtime.sendMessage({
          type: 'register-download-index',
          id,
          index: currentIndex,
          total: galleryPageInfoRef.current.totalImages,
          downloadPath: configRef.current.intermediateDownloadPath
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
    }
  };

  useEffect(() => {
    if (status === StatusEnum.Downloading && downloadCount > 0 && downloadCount === finishedList.length) {
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
        const { data: galleryHtmlStr } = await axios.get(galleryFrontPageUrl.current).catch(() => ({ data: '' }));
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
          intermediateDownloadPath: configRef.current.intermediateDownloadPath + removeInvalidCharFromFilename(galleryInfo.name)
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
        info: galleryInfo
      });
    } catch (e) {
      console.error('add download history failed@', e);
    }
    setStatus(StatusEnum.Downloading);
    await sendRuntimeMessage({
      type: 'clear-download-index-map'
    });
    await sendRuntimeMessage({
      type: 'set-download-context',
      downloadPath: configRef.current.intermediateDownloadPath,
      total: galleryPageInfoRef.current.totalImages
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
            <div className="fixed inset-0 flex flex-col items-center justify-center gap-4">
              <Spinner size="lg" color="primary" />
              <p className="animate-pulse text-sm text-gray-400">Initializing...</p>
            </div>
          );
        case StatusEnum.EHentaiOther:
          return (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
                <svg className="h-6 w-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="mb-1 text-sm font-medium text-amber-100">Non-gallery Page Detected</h3>
                <p className="text-xs text-amber-200/80">Navigate to a gallery page to start downloading</p>
              </div>
            </div>
          );
        case StatusEnum.OtherPage:
          return (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-700/50 bg-gradient-to-br from-gray-800/40 to-gray-900/40 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/20">
                <svg className="h-6 w-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <div className="space-y-4 text-center">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">Navigate to Gallery</h3>
                  <p className="text-xs text-gray-400">Visit a gallery page to start downloading</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <span>Go to</span>
                  <Link href="https://e-hentai.org/" isExternal className="underline">
                    E-Hentai
                  </Link>
                  <span className="text-gray-500">or</span>
                  <Link href="https://exhentai.org/" isExternal className="underline">
                    ExHentai
                  </Link>
                </div>
              </div>
            </div>
          );
        case StatusEnum.BeforeDownload:
          return (
            <div className="flex flex-col gap-8">
              <div className="space-y-2 px-8 text-center">
                <h2 className="line-clamp-2 text-xl font-bold leading-tight text-slate-100" title={galleryTitle}>
                  {galleryTitle}
                </h2>
                <p className="text-sm font-medium text-slate-400">{galleryPageInfo.totalImages} images found</p>
              </div>
              <div className="flex flex-col gap-6 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 shadow-sm">
                {range[1] > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-sm font-medium text-slate-300">Range Selection</label>
                      <span className="text-xs text-slate-500">
                        {range[0]} - {range[1]}
                      </span>
                    </div>
                    <PageSelector range={range} setRange={setRange} maxValue={galleryPageInfo.totalImages} />
                  </div>
                )}
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/50 px-4 py-3">
                    <span className="text-sm text-slate-400">Selected</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-slate-100">{downloadCount}</span>
                      <span className="text-xs text-slate-500">images</span>
                    </div>
                  </div>
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 font-semibold text-slate-100 transition-all duration-200 hover:border-slate-500 hover:bg-slate-700"
                    onClick={handleClickDownload}>
                    <DownloadIcon />
                    Start Download
                  </button>
                </div>
              </div>
            </div>
          );
        case StatusEnum.Downloading:
          return (
            <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-8">
              <div className="space-y-2 text-center">
                <h3 className="line-clamp-2 text-lg font-medium text-slate-200">{galleryTitle}</h3>
                <div className="flex items-center justify-center gap-2">
                  <Spinner size="sm" color="default" />
                  <span className="text-sm text-slate-400">Downloading...</span>
                </div>
              </div>
              <div className="w-full rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">{renders.progress()}</div>
            </div>
          );
        case StatusEnum.DownloadSuccess:
          return (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                <svg className="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-2 text-center">
                <h3 className="text-sm font-semibold text-green-100">Download Completed!</h3>
                <p className="text-xs text-gray-400">
                  Enjoying the extension?{' '}
                  <Link href="https://github.com/Oc1S/ehentai-helper" isExternal className="underline underline-offset-2">
                    Star it on GitHub
                  </Link>
                </p>
              </div>
            </div>
          );
        case StatusEnum.Fail:
          return (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/10 to-rose-500/10 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
                <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="mb-1 text-sm font-medium text-red-100">Connection Failed</h3>
                <p className="text-xs text-red-200/80">Unable to fetch data from server. Please try again later.</p>
              </div>
            </div>
          );
      }
    },
    progress: () => (
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Progress</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">{finishedList.length}</span>
            <span className="text-gray-500">/</span>
            <span className="text-lg font-medium text-gray-300">{downloadCount}</span>
          </div>
        </div>
        <div className="space-y-2">
          <Progress
            aria-label="Download progress"
            value={finishedList.length}
            minValue={0}
            maxValue={downloadCount}
            className="w-full"
            classNames={{
              base: 'max-w-md',
              track: 'drop-shadow-md border border-default',
              indicator: 'bg-gradient-to-r from-primary-500 to-primaryBlue-500',
              label: 'tracking-wider font-medium text-default-600',
              value: 'text-foreground-600'
            }}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{Math.round((finishedList.length / downloadCount) * 100)}% complete</span>
            <span>{downloadCount - finishedList.length} remaining</span>
          </div>
        </div>
      </div>
    )
  };

  return (
    <AppShell>
      <div className="flex h-full w-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="text-sm font-medium text-slate-300">Ehentai Helper</div>
          <DownloadSettings />
        </div>
        <Tabs aria-label="popup tabs" className="px-4 pt-3">
          <Tab key="info" title="Info">
            <div className="pt-4">
              {status === StatusEnum.Loading && renders.status()}
              {[StatusEnum.OtherPage, StatusEnum.EHentaiOther, StatusEnum.Fail].includes(status) && (
                <div className="flex justify-center">{renders.status()}</div>
              )}
              {status === StatusEnum.DownloadSuccess && (
                <div className="flex flex-col items-center gap-6">
                  <div className="text-center">
                    <h3 className="mb-2 line-clamp-2 text-lg font-bold text-slate-100">{galleryTitle}</h3>
                    <p className="text-slate-400">All images downloaded successfully</p>
                  </div>
                  {renders.status()}
                  <div className="w-full max-w-sm rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
                    {renders.progress()}
                  </div>
                </div>
              )}
              {status === StatusEnum.BeforeDownload && renders.status()}
              {status === StatusEnum.Downloading && renders.status()}
            </div>
          </Tab>
          <Tab key="downloadList" title="DownloadList">
            <div className="pt-4">
              <DownloadTable />
            </div>
          </Tab>
          <Tab key="history" title="History">
            <div className="pt-4">
              <History />
            </div>
          </Tab>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default withErrorBoundary(withSuspense(PopupLayout, <div>Loading ...</div>), <div>Something went wrong</div>);
