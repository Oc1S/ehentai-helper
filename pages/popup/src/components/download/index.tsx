import { useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultConfig,
  EXTENSION_NAME,
  getCurrentTabUrl,
  isEHentaiGalleryUrl,
  isEHentaiPageUrl,
  isObject,
  useCreation,
  useMounted,
  useStateRef,
} from '@ehentai-helper/shared';
import { Button, type ButtonProps, Chip, Link, type LinkProps, Progress, Spinner } from '@nextui-org/react';
import axios from 'axios';
import clsx from 'clsx';
import { atom, useAtom } from 'jotai';

import { DownloadContext } from '@/Context';
import { useDownload } from '@/hooks';
import {
  downloadAsTxtFile,
  extractGalleryInfo,
  extractGalleryPageInfo,
  extractGalleryTags,
  htmlStr2DOM,
  removeInvalidCharFromFilename,
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

const downloadListAtom = atom<chrome.downloads.DownloadItem[]>([]);

export const Download = () => {
  const [status, setStatus] = useState<StatusEnum>(StatusEnum.Loading);
  const galleryFrontPageUrl = useRef('');

  /* alter when mounted */
  const configRef = useRef(defaultConfig);

  const [downloadList, setDownloadList] = useAtom(downloadListAtom);

  const imageIdMap = useCreation(() => new Map<number, number>());
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
        const originalImage = (doc.getElementById('i7')?.childNodes?.[3] as HTMLAnchorElement)?.href;
        imageUrl = originalImage ?? imageUrl;
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
            <Spinner size="md" color="secondary" className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
          );
        case StatusEnum.EHentaiOther:
          return (
            <Chip variant="flat" className="bg-indigo-500/20">
              You are at an image page, to start downloading, go to a gallery page.
            </Chip>
          );
        case StatusEnum.OtherPage:
          return renderGotoEHentai();
        case StatusEnum.BeforeDownload:
          return (
            <Chip variant="flat" className="bg-indigo-500/20">
              Ready to download
            </Chip>
          );
        case StatusEnum.Downloading:
          return (
            <Chip variant="flat" className="bg-indigo-500/20">
              😘Do NOT close this popup page before ALL download tasks start.
            </Chip>
          );
        case StatusEnum.DownloadSuccess:
          return (
            <div>
              <div>Congrats! Download completed.</div>
              <div>
                If you find this extension helpful, you can give me a star at{' '}
                <Link href="https://github.com/Oc1S/ehentai-helper" isExternal>
                  Github
                </Link>
                🤗
              </div>
            </div>
          );
        case StatusEnum.Fail:
          return 'Failed to fetch data from the server, please retry later.';
      }
    },
    progress: () => (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center">
          <div className="mr-2">Progress:</div>
          <div className="text-yellow-100">
            {finishedList.length} / {downloadCount}
          </div>
        </div>
        <Progress
          aria-label="Loading..."
          value={finishedList.length}
          minValue={0}
          maxValue={endIndex - startIndex + 1}
          className="w-[200px]"
        />
      </div>
    ),
  };

  const handleDownloadCreated: Parameters<typeof chrome.downloads.onCreated.addListener>[0] = downloadItem => {
    setDownloadList(prev => {
      return [...prev, downloadItem];
    });
  };

  const handleDownloadChanged: Parameters<typeof chrome.downloads.onChanged.addListener>[0] = downloadDelta => {
    const { id } = downloadDelta;
    const newVal = {};
    for (const key in downloadDelta) {
      if (isObject(downloadDelta[key])) {
        newVal[key] = downloadDelta[key].current;
      }
    }
    setDownloadList(prev => prev.map(item => (item.id === id ? { ...item, ...newVal } : item)));
  };

  // Save to the corresponding folder and rename files.
  const handleDeterminFilename: Parameters<typeof chrome.downloads.onDeterminingFilename.addListener>[0] = (
    downloadItem,
    suggest
  ) => {
    if (downloadItem.byExtensionName !== EXTENSION_NAME) return;
    const { id } = downloadItem;
    let { filename } = downloadItem;
    const { intermediateDownloadPath, fileNameRule, filenameConflictAction: conflictAction } = configRef.current;
    const name = filename.substring(0, filename.lastIndexOf('.') + 1);
    const fileType = filename.substring(filename.lastIndexOf('.') + 1);
    // Metadata.
    if (fileType === 'txt') {
      const { url } = downloadItem;
      // 'name' is the first key of info file.
      const isInfoFile = url.substring(url.indexOf(',') + 1).startsWith('name');
      filename = `${intermediateDownloadPath}/${isInfoFile ? 'info.txt' : 'tags.txt'}`;
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
      className: 'mx-1 bg-indigo-500/20 hover:bg-indigo-500/50 transition-all mt-1',
    } satisfies LinkProps & ButtonProps;
    return (
      <div className="flex h-full w-full items-center justify-center">
        Go to a
        <Button {...buttonProps} href="https://e-hentai.org/">
          E-Hentai
        </Button>
        or
        <Button {...buttonProps} href="https://exhentai.org/">
          ExHentai
        </Button>
        gallery page to start downloading.
      </div>
    );
  };

  useMounted(() => {
    (async () => {
      const url = await getCurrentTabUrl().catch(() => '');
      console.log('start');
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
          // setIsBtnVisible(true);
        });
        return;
      }
      console.log('no');
      // other page.
      if (isEHentaiPageUrl(url)) {
        console.log('other');
        setStatus(StatusEnum.EHentaiOther);
        return;
      }
      // Not on valid page.
      setStatus(StatusEnum.OtherPage);
      // setIsBtnVisible(false);
    })();
  });

  return (
    <DownloadContext.Provider
      value={{
        downloadList,
        imageIdMap,
        setDownloadList,
      }}>
      <div className="flex flex-col items-center justify-center gap-6 p-2">
        <div className="mb-12">{renders.status()}</div>

        {[StatusEnum.Downloading, StatusEnum.DownloadSuccess].includes(status) && renders.progress()}

        {[StatusEnum.BeforeDownload].includes(status) && (
          <div className="flex flex-col items-center gap-4">
            {!!totalImages && (
              <div className="flex items-center">
                <div className="mr-2">Download page count:</div>
                <div className="text-yellow-100">
                  {downloadCount} / {totalImages}
                </div>
              </div>
            )}

            {range[1] > 0 && <PageSelector range={range} setRange={setRange} maxValue={totalImages} />}

            <Button
              // hidden={isBtnVisible}
              className={clsx(
                'mt-4 transform rounded border border-gray-700 bg-gray-900/90 px-4 py-2 font-bold text-gray-300 shadow-md shadow-gray-700/30 transition-all duration-300 hover:text-white'
              )}
              onPress={() => {
                setStatus(StatusEnum.Downloading);
                downloadJob.downloadAllImages();
                if (configRef.current.saveGalleryInfo) {
                  downloadAsTxtFile(JSON.stringify(galleryInfo, null, 2));
                }
                if (configRef.current.saveGalleryTags) {
                  downloadAsTxtFile(JSON.stringify(galleryTags, null, 2));
                }
                // setIsBtnVisible(false);
              }}>
              Download
            </Button>
          </div>
        )}
      </div>
    </DownloadContext.Provider>
  );
};
