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
  withErrorBoundary,
  withSuspense,
} from '@ehentai-helper/shared';
import { Button, Card, CardBody, Link, Progress, Spinner, Tab, Tabs } from '@nextui-org/react';
import axios from 'axios';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PageSelector } from './components';
import DownloadTable from './components/Table';
import { DownloadContext } from './Context';
import { useDownload } from './hooks';
// import mockLost from './mock/downloadList';
import {
  extractGalleryInfo,
  extractGalleryTags,
  generateTxtFile,
  htmlStr2DOM,
  removeInvalidCharFromFilename,
} from './utils';

// Gallery information.
let galleryInfo: Record<string, any> = {};
let galleryTags: Record<string, any> = {};

enum StatusEnum {
  Loading,
  OtherPage,
  EHentaiOther,
  Fail,
  BeforeDownload,
  Downloading,
  DownLoadSuccess,
}

const Popup = () => {
  const [status, setStatus] = useState<StatusEnum>(StatusEnum.Loading);
  const galleryFrontPageUrl = useRef('');

  const [isBtnVisible, setIsBtnVisible] = useState(false);
  /* alter when mounted */
  const configRef = useRef(defaultConfig);

  const [downloadList, setDownloadList] = useState<chrome.downloads.DownloadItem[]>([]);
  const imageIdMap = useCreation(() => new Map<number, number>());
  const [galleryPageInfo, setGalleryPageInfo, galleryPageInfoRef] = useStateRef({
    imagesPerPage: 0,
    numPages: 0,
    totalImages: 0,
  });

  const { totalImages } = galleryPageInfo;
  const finishedList = downloadList.filter(item => item.state === 'complete');

  const extractImagePageUrls = (html: string) => {
    const urls: string[] = [];
    const doc = htmlStr2DOM(html);
    // Normal previews.
    let elements = doc.getElementsByClassName('gdtm');
    for (let index = 0; index < elements.length; index++) {
      urls.push((elements[index].childNodes[0].childNodes[0] as HTMLAnchorElement).href);
    }
    // Large previews.
    elements = doc.getElementsByClassName('gdtl');
    for (let index = 0; index < elements.length; index++) {
      urls.push((elements[index].childNodes[0] as HTMLAnchorElement).href);
    }
    return urls;
  };

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

  /* 获取单张图片 */
  const processImagePage = async (url: string, pageIndex: number, imageIndex: number) => {
    const currentIndex = pageIndex * galleryPageInfo.imagesPerPage + imageIndex + 1;
    if (currentIndex < startIndex || currentIndex > endIndex) return;
    const res = await axios.get(url);
    const responseText = res.data;
    const doc = htmlStr2DOM(responseText);
    let imageUrl = (doc.getElementById('img') as HTMLImageElement).src;
    if (configRef.current.saveOriginalImages) {
      const originalImage = (doc.getElementById('i7')?.childNodes?.[3] as HTMLAnchorElement)?.href;
      imageUrl = originalImage ?? imageUrl;
    }
    chrome.downloads.download({ url: imageUrl }, id => {
      imageIdMap.set(id, currentIndex);
    });
  };

  /* 获取gallery整页所有图片 */
  const processGalleryPage = async (pageIndex: number) => {
    if (pageIndex < start.page || pageIndex > end.page) return;
    const pageUrl = `${galleryFrontPageUrl.current}?p=${pageIndex}`;
    const { data: responseText } = await axios.get(pageUrl);
    const imagePageUrls = extractImagePageUrls(responseText);
    processImagePage(imagePageUrls[0], pageIndex, 0); // Start immediately.
    let imageIndex = 1;
    const imageInterval = setInterval(() => {
      if (imageIndex === imagePageUrls.length) {
        clearInterval(imageInterval);
        return;
      }
      processImagePage(imagePageUrls[imageIndex], pageIndex, imageIndex);
      imageIndex++;
    }, configRef.current.downloadInterval);
    return imagePageUrls.length;
  };

  /** 开启下载图片 */
  const downloadAllImages = () => {
    let pageIndex = start.page;
    processGalleryPage(pageIndex); // Start immediately.
    pageIndex++;
    const pageInterval = setInterval(() => {
      if (pageIndex === galleryPageInfo.numPages) {
        clearInterval(pageInterval);
        return;
      }
      processGalleryPage(pageIndex);
      pageIndex++;
    }, configRef.current.downloadInterval * galleryPageInfo.imagesPerPage);
  };

  /**
   * 获取页码信息
   */
  const extractGalleryPageInfo = (html: string) => {
    const doc = htmlStr2DOM(html);
    const pageInfoStr = doc.querySelector('.gpc')?.innerHTML || '';
    const res = /Showing 1 - (\d+) of (\d*,*\d+) images/.exec(pageInfoStr);
    if (!res) return;
    const pageInfo = {
      imagesPerPage: 0,
      totalImages: 0,
      numPages: 0,
    };
    pageInfo.imagesPerPage = +res[1];
    // format 1,100 etc.
    pageInfo.totalImages = +res[2].replace(',', '');
    if (pageInfo.imagesPerPage && pageInfo.totalImages) {
      pageInfo.numPages = Math.ceil(pageInfo.totalImages / pageInfo.imagesPerPage);
    }
    setGalleryPageInfo(pageInfo);
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

  useEffect(() => {
    if (status === StatusEnum.Downloading && galleryPageInfoRef.current.totalImages === finishedList.length) {
      setStatus(StatusEnum.DownLoadSuccess);
    }
  }, [status, downloadList]);

  // Save to the corresponding folder and rename files.
  const handleDeterminingFilename: Parameters<typeof chrome.downloads.onDeterminingFilename.addListener>[0] = (
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

  useDownload({
    onDownloadCreated: handleDownloadCreated,
    onDownloadChanged: handleDownloadChanged,
    onDeterminingFilename: handleDeterminingFilename,
  });

  const renderStatus = () => {
    switch (status) {
      default:
      case StatusEnum.Loading:
        return (
          <Spinner size="md" color="secondary" className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        );
      case StatusEnum.OtherPage:
        return (
          <>
            🚧Please go to a
            <Link href="https://e-hentai.org/" isExternal className="px-1">
              E-Hentai
            </Link>
            /
            <Link href="https://exhentai.org/" isExternal className="px-1">
              ExHentai
            </Link>
            gallery page.
          </>
        );
      case StatusEnum.BeforeDownload:
        return 'Ready to download';
      case StatusEnum.Downloading:
        return <>🤗Please do NOT close the extension popup page before ALL download tasks start.</>;
      case StatusEnum.DownLoadSuccess:
        return (
          <div>
            <div>Congrats! Download completed.</div>
            <div>
              If this extension proves beneficial to you, please give me a star at
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
  };
  const progress = (
    <>
      <div className="flex flex-col items-center gap-1">
        {status >= StatusEnum.BeforeDownload && (
          <div className="flex items-center">
            <div>Total Page:</div>
            <div>{totalImages}</div>
          </div>
        )}
        {finishedList.length > 0 && (
          <Progress
            aria-label="Loading..."
            value={finishedList.length}
            minValue={0}
            maxValue={endIndex - startIndex + 1}
            className="w-[200px]"
          />
        )}
      </div>
    </>
  );

  useMounted(() => {
    (async () => {
      const url = await getCurrentTabUrl().catch(() => '');
      // gallery page.
      if (isEHentaiGalleryUrl(url)) {
        chrome.storage.sync.get(defaultConfig, async items => {
          configRef.current = items as typeof configRef.current;
          galleryFrontPageUrl.current = url.substring(0, url.lastIndexOf('/') + 1);
          const { data: htmlStr } = await axios.get(galleryFrontPageUrl.current).catch(() => ({
            data: '',
          }));
          if (!htmlStr) {
            setStatus(StatusEnum.Fail);
            return;
          }
          extractGalleryPageInfo(htmlStr);
          galleryInfo = extractGalleryInfo(htmlStr);
          galleryTags = extractGalleryTags(htmlStr);
          configRef.current.intermediateDownloadPath += removeInvalidCharFromFilename(galleryInfo.name);
          setStatus(StatusEnum.BeforeDownload);
          setIsBtnVisible(true);
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
      setIsBtnVisible(false);
    })();
  });

  return (
    <DownloadContext.Provider
      value={{
        downloadList,
        imageIdMap,
        setDownloadList,
      }}>
      <Card className="h-full w-full" radius="none">
        <CardBody className="items-center">
          <Tabs color="secondary">
            <Tab key="info" title="Info">
              <div className="flex flex-col items-center justify-center gap-4 p-2">
                <div>{renderStatus()}</div>
                {progress}

                {[StatusEnum.BeforeDownload].includes(status) && (
                  <div className="fixed bottom-48 flex flex-col items-center">
                    {range[1] > 0 && <PageSelector range={range} setRange={setRange} maxValue={totalImages} />}
                    <Button
                      color="primary"
                      hidden={isBtnVisible}
                      className={clsx('mt-4')}
                      onClick={() => {
                        setStatus(StatusEnum.Downloading);
                        downloadAllImages();
                        if (configRef.current.saveGalleryInfo) {
                          generateTxtFile(JSON.stringify(galleryInfo, null, 2));
                        }
                        if (configRef.current.saveGalleryTags) {
                          generateTxtFile(JSON.stringify(galleryTags, null, 2));
                        }
                        setIsBtnVisible(false);
                      }}>
                      Download
                    </Button>
                  </div>
                )}
              </div>
            </Tab>
            <Tab key="downloadList" title="DownloadList">
              <DownloadTable />
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </DownloadContext.Provider>
  );
};

export default withErrorBoundary(
  withSuspense(Popup, <div>Loading ...</div>),
  <div className="flex h-screen items-center justify-center">Something went wrong...</div>
);
