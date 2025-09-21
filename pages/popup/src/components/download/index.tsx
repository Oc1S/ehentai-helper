import { useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultConfig,
  EXTENSION_NAME,
  getCurrentTabUrl,
  isEHentaiGalleryUrl,
  isEHentaiPageUrl,
  isObject,
  useMounted,
  useStateRef,
} from '@ehentai-helper/shared';
import { downloadHistoryStorage } from '@ehentai-helper/storage';
import { Button, type ButtonProps, Link, type LinkProps, Progress, Spinner } from '@nextui-org/react';
import axios from 'axios';
import { produce } from 'immer';
import { atom, useAtom } from 'jotai';

import { useDownload } from '@/hooks';
import {
  downloadAsTxtFile,
  extractGalleryInfo,
  extractGalleryPageInfo,
  extractGalleryTags,
  htmlStr2DOM,
  removeInvalidCharFromFilename,
  splitFilename,
} from '@/utils';

import { PageSelector } from '../page-selector';

enum StatusEnum {
  Loading = 0,
  OtherPage = 1,
  EHentaiOther = 2,
  Fail = 3,
  BeforeDownload = 4,
  Downloading = 5,
  DownloadSuccess = 6,
}

// Gallery information.
let galleryInfo: Record<string, any> = {};
let galleryTags: Record<string, any> = {};

/* id => index */
export const imageIdMap = new Map<number, number>();

export const downloadListAtom = atom<chrome.downloads.DownloadItem[]>([]);
const downloadStatusAtom = atom<StatusEnum>(StatusEnum.Loading);

export const Download = () => {
  const [status, setStatus] = useAtom(downloadStatusAtom);
  const galleryFrontPageUrl = useRef('');

  /* alter when mounted */
  const configRef = useRef(defaultConfig);

  const [downloadList, setDownloadList] = useAtom(downloadListAtom);

  const [galleryPageInfo, setGalleryPageInfo, galleryPageInfoRef] = useStateRef({
    imagesPerPage: 0,
    numPages: 0,
    totalImages: 0,
  });

  const { totalImages } = galleryPageInfo;
  const finishedList = downloadList.filter(item => item.state === 'complete');

  const [range, setRange] = useState<[number, number]>([1, galleryPageInfo.totalImages]);
  useEffect(() => {
    setRange([1, galleryPageInfo.totalImages]);
  }, [galleryInfo]);

  const [startIndex, endIndex] = range;
  const [start, end] = useMemo(() => {
    const start = {
      indexOfPage: (startIndex % galleryPageInfo.imagesPerPage) - 1,
      page: ~~(startIndex / galleryPageInfo.imagesPerPage),
    };
    const end = {
      indexOfPage: (endIndex % galleryPageInfo.imagesPerPage) - 1,
      page: ~~(endIndex / galleryPageInfo.imagesPerPage),
    };
    return [start, end];
  }, [galleryPageInfo.imagesPerPage, startIndex, endIndex]);
  const downloadCount = range[1] - range[0] + 1;

  const downloadJob = {
    /* 1.获取gallery整页所有图片 */
    processGalleryPage: async (pageIndex: number) => {
      if (pageIndex < start.page || pageIndex > end.page) return;
      const pageUrl = `${galleryFrontPageUrl.current}?p=${pageIndex}`;
      const { data: pageHtml } = await axios.get(pageUrl);
      const imagePageUrls = downloadJob.extractImagePageUrls(pageHtml);
      downloadJob.downloadImage(imagePageUrls[0], pageIndex, 0); // Start immediately.
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

    /* 2.get image page urls from gallery page */
    extractImagePageUrls: (html: string) => {
      const doc = htmlStr2DOM(html);
      return Array.from(doc.getElementById('gdt')?.childNodes || []).map(n => (n as HTMLAnchorElement).href);
    },

    /* 3. download image from image page */
    downloadImage: async (url: string, pageIndex: number, imageIndex: number) => {
      const currentIndex = pageIndex * galleryPageInfo.imagesPerPage + imageIndex + 1;
      if (currentIndex < startIndex || currentIndex > endIndex) return;
      const res = await axios.get(url);
      const responseText = res.data;
      const doc = htmlStr2DOM(responseText);
      let imageUrl = (doc.getElementById('img') as HTMLImageElement).src;
      // original
      if (configRef.current.saveOriginalImages) {
        try {
          const originalImage = (doc.getElementById('i6')?.childNodes?.[3] as HTMLDivElement).getElementsByTagName(
            'a'
          )[0].href;
          imageUrl = originalImage || imageUrl;
        } catch (e) {
          console.log('get original image failed@', e);
        }
      }
      chrome.downloads.download({ url: imageUrl }, id => {
        imageIdMap.set(id, currentIndex);
      });
    },

    /** 开启下载图片 */
    downloadAllImages: () => {
      let pageIndex = start.page;
      downloadJob.processGalleryPage(pageIndex); // Start immediately.
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
          return renderGotoEHentai();
        case StatusEnum.BeforeDownload:
          return (
            <div className="from-primary-500/20 to-primaryBlue-500/20 border-primary-500/30 mt-8 flex items-center gap-3 rounded-xl border bg-gradient-to-r px-4 py-3">
              <div className="bg-primary-500 h-2 w-2 animate-pulse rounded-full" />
              <span className="text-primary-100 text-sm font-medium">Ready to download</span>
            </div>
          );
        case StatusEnum.Downloading:
          return (
            <div className="from-primaryBlue-500/20 to-primary-500/20 border-primaryBlue-500/30 flex flex-col items-center gap-3 rounded-xl border bg-gradient-to-r p-4">
              <div className="flex items-center gap-2">
                <div className="bg-primaryBlue-500 h-2 w-2 animate-pulse rounded-full" />
                <span className="text-primaryBlue-100 text-sm font-medium">Downloading in progress</span>
              </div>
              <p className="text-center text-xs leading-relaxed text-gray-400">
                Please keep this popup open until all downloads start
              </p>
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
                  <Link
                    href="https://github.com/Oc1S/ehentai-helper"
                    isExternal
                    className="text-primary-400 hover:text-primary-300 underline underline-offset-2">
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
              value: 'text-foreground-600',
            }}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{Math.round((finishedList.length / downloadCount) * 100)}% complete</span>
            <span>{downloadCount - finishedList.length} remaining</span>
          </div>
        </div>
      </div>
    ),
  };

  const handleDownloadCreated: Parameters<typeof chrome.downloads.onCreated.addListener>[0] = downloadItem => {
    const [, fileType] = splitFilename(downloadItem.filename);
    if (fileType === 'json') {
      return;
    }
    setDownloadList(prev => {
      return [...prev, downloadItem];
    });
  };

  const handleDownloadChanged: Parameters<typeof chrome.downloads.onChanged.addListener>[0] = downloadDelta => {
    const { id } = downloadDelta;
    const newVal = {};
    /* patch item from downloadDelta */
    for (const key in downloadDelta) {
      if (isObject(downloadDelta[key])) {
        newVal[key] = downloadDelta[key].current;
      }
    }
    setDownloadList(
      produce(draft => {
        const targetIndex = draft.findIndex(item => item.id === id);
        draft[targetIndex] = { ...draft[targetIndex], ...newVal };
      })
    );
  };

  // Save to the corresponding folder and rename files.
  const handleDeterminFilename: Parameters<typeof chrome.downloads.onDeterminingFilename.addListener>[0] = (
    downloadItem,
    suggest
  ) => {
    if (downloadItem.byExtensionName !== EXTENSION_NAME) return;
    const { id } = downloadItem;
    const { intermediateDownloadPath, fileNameRule, filenameConflictAction: conflictAction } = configRef.current;

    let { filename } = downloadItem;
    const [name, fileType] = splitFilename(filename);
    // Metadata.
    if (['txt', 'json'].includes(fileType)) {
      filename = `${intermediateDownloadPath}/info.json`;
    } else {
      filename = `${intermediateDownloadPath}/${fileNameRule
        .replace('[index]', String(imageIdMap.get(id)))
        .replace('[name]', name)
        .replace('[total]', `${galleryPageInfoRef.current.totalImages}`)}.${fileType}`;
    }

    suggest({
      filename,
      conflictAction,
    });
  };

  useEffect(() => {
    if (status === StatusEnum.Downloading && downloadCount === finishedList.length) {
      setStatus(StatusEnum.DownloadSuccess);
    }
  }, [status, downloadList]);

  useDownload({
    onDownloadCreated: handleDownloadCreated,
    onDownloadChanged: handleDownloadChanged,
    onDeterminingFilename: handleDeterminFilename,
  });

  const renderGotoEHentai = () => {
    const buttonProps = {
      size: 'sm',
      as: Link,
      isExternal: true,
      variant: 'flat',
      className:
        'px-3 py-2 bg-gradient-to-r from-primary-500/20 to-primaryBlue-500/20 hover:from-primary-500/30 hover:to-primaryBlue-500/30 border border-primary-500/30 hover:border-primary-400/50 transition-all duration-200 text-primary-100 hover:text-white font-medium',
    } satisfies LinkProps & ButtonProps;
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-700/50 bg-gradient-to-br from-gray-800/40 to-gray-900/40 p-6">
        {/* circle */}
        <div className="bg-primary-500/20 flex h-12 w-12 items-center justify-center rounded-full">
          {/* link icon */}
          <svg className="text-primary-400 h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <Button {...buttonProps} href="https://e-hentai.org/">
              E-Hentai
            </Button>
            <span className="text-gray-500">or</span>
            <Button {...buttonProps} href="https://exhentai.org/">
              ExHentai
            </Button>
          </div>
        </div>
      </div>
    );
  };

  useMounted(() => {
    (async () => {
      const url = await getCurrentTabUrl().catch(() => '');
      // gallery page.
      if (isEHentaiGalleryUrl(url)) {
        chrome.storage.sync.get(defaultConfig, async items => {
          configRef.current = items as typeof configRef.current;
          galleryFrontPageUrl.current = url.substring(0, url.lastIndexOf('/') + 1);
          const { data: galleryHtmlStr } = await axios.get(galleryFrontPageUrl.current).catch(() => ({
            data: '',
          }));
          if (!galleryHtmlStr) {
            setStatus(StatusEnum.Fail);
            return;
          }
          const pageInfo = extractGalleryPageInfo(galleryHtmlStr);
          setGalleryPageInfo(pageInfo);
          galleryInfo = extractGalleryInfo(galleryHtmlStr);
          galleryTags = extractGalleryTags(galleryHtmlStr);
          configRef.current.intermediateDownloadPath += removeInvalidCharFromFilename(galleryInfo.name);
          setStatus(StatusEnum.BeforeDownload);
        });
        return;
      }
      // other page.
      if (isEHentaiPageUrl(url)) {
        setStatus(StatusEnum.EHentaiOther);
        return;
      }
      // Not on valid page.
      setStatus(StatusEnum.OtherPage);
    })();
  });

  return (
    <div className="mx-auto flex h-[480px] w-full flex-col justify-center gap-8">
      {/* Header Area */}
      <div className="-mt-16 flex flex-col items-center justify-center">{renders.status()}</div>

      {/* Progress Section */}
      {[StatusEnum.Downloading, StatusEnum.DownloadSuccess].includes(status) && (
        <div className="border-t border-gray-700/30 bg-gray-800/20 px-8 py-6">{renders.progress()}</div>
      )}

      {/* Download selection */}
      {[StatusEnum.BeforeDownload].includes(status) && (
        <div className="border-t border-gray-700/30 bg-gray-800/20 px-8 py-6">
          <div className="space-y-6">
            {/* Page Range Selector */}
            {range[1] > 0 && (
              <div className="space-y-4">
                <div className="border-b border-gray-600/20 pb-2">
                  <label className="text-sm font-medium text-gray-200">Range Selection</label>
                </div>
                <PageSelector range={range} setRange={setRange} maxValue={totalImages} />
              </div>
            )}

            {/* Gallery Statistics */}
            {!!totalImages && (
              <div className="rounded-lg border border-gray-600/30 bg-gray-700/30 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Selected</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-white">{downloadCount}</span>
                    <span className="text-sm text-gray-400">of {totalImages}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Download Button */}
            <div className="pt-2">
              <Button
                size="lg"
                className="h-12 w-full border border-slate-600 bg-slate-800 font-medium text-slate-100 shadow-sm transition-all duration-200 hover:border-slate-500 hover:bg-slate-700 hover:text-white hover:shadow-md"
                onPress={async () => {
                  try {
                    await downloadHistoryStorage.add({
                      url: galleryFrontPageUrl.current,
                      name: galleryInfo.name,
                      range,
                    });
                  } catch (e) {
                    console.error('add download history failed@', e);
                  }
                  setStatus(StatusEnum.Downloading);
                  downloadJob.downloadAllImages();
                  if (configRef.current.saveGalleryInfo) {
                    galleryInfo.category = galleryTags;
                    downloadAsTxtFile(JSON.stringify(galleryInfo, null, 2));
                  }
                }}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-1 h-4 w-4">
                  <path d="M12 13v8l-4-4" />
                  <path d="m12 21 4-4" />
                  <path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284" />
                </svg>
                Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
