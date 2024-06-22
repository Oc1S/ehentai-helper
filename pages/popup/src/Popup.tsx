import {
  defaultConfig,
  EXTENSION_NAME,
  getCurrentTabUrl,
  isEHentaiGalleryUrl,
  isEHentaiPageUrl,
  isObject,
  useMounted,
  withErrorBoundary,
  withSuspense,
} from '@ehentai-helper/shared';
import { Button, Card, CardBody, Link, Spinner, Tab, Tabs } from '@nextui-org/react';
import axios from 'axios';
import clsx from 'clsx';
import { useRef, useState } from 'react';

import DownloadTable from './components/Table';
import { useDownload } from './hooks';
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
  BeforeDownload,
  Fail,
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
  const imageIdMapRef = useRef(new Map<number, number>());
  const [galleryPageInfo, setGalleryPageInfo] = useState({
    numImagesPerPage: 0,
    totalNumImages: 0,
    numPages: 0,
  });
  const finishedList = downloadList.filter(item => item.state === 'complete');
  const { totalNumImages } = galleryPageInfo;

  const extractImagePageUrls = (html: string) => {
    const urls = [];
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

  /* 获取单张图片 */
  const processImagePage = async (url: string, pageIndex: number, imageIndex: number) => {
    const res = await axios.get(url);
    const responseText = res.data;
    const doc = htmlStr2DOM(responseText);
    let imageUrl = (doc.getElementById('img') as HTMLImageElement).src;
    if (configRef.current.saveOriginalImages) {
      const originalImage = (doc.getElementById('i7')?.childNodes[3] as HTMLAnchorElement).href;
      imageUrl = originalImage ?? imageUrl;
    }
    chrome.downloads.download({ url: imageUrl }, id => {
      imageIdMapRef.current.set(id, pageIndex * galleryPageInfo.numImagesPerPage + imageIndex + 1);
    });
  };

  /* 获取gallery整页所有图片 */
  const processGalleryPage = async (url: string, pageIndex: number) => {
    const { data: responseText } = await axios.get(url);
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
    processGalleryPage(galleryFrontPageUrl.current, 0); // Start immediately.
    let pageIndex = 1;
    // 下载该页图片后，继续下载下一页
    const pageInterval = setInterval(() => {
      if (pageIndex === galleryPageInfo.numPages) {
        clearInterval(pageInterval);
        return;
      }
      processGalleryPage(galleryFrontPageUrl.current + '?p=' + pageIndex, pageIndex);
      pageIndex++;
    }, configRef.current.downloadInterval * galleryPageInfo.numImagesPerPage);
  };

  /**
   * 获取页码信息
   */
  const extractNumGalleryPages = (html: string) => {
    const pageInfo = {
      numImagesPerPage: 0,
      totalNumImages: 0,
      numPages: 0,
    };
    const doc = htmlStr2DOM(html);
    const elements = doc.getElementsByClassName('gpc');
    const pageInfoStr = elements[0].innerHTML;
    const patternImageNumbers = /Showing 1 - (\d+) of (\d*,*\d+) images/;
    const res = patternImageNumbers.exec(pageInfoStr);
    if (!res) return;
    pageInfo.numImagesPerPage = +res[1];
    pageInfo.totalNumImages = +res[2].replace(',', '');
    if (pageInfo.numImagesPerPage && pageInfo.totalNumImages) {
      pageInfo.numPages = Math.ceil(pageInfo.totalNumImages / pageInfo.numImagesPerPage);
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

  // Save to the corresponding folder and rename files.
  const handleDeterminingFilename: Parameters<typeof chrome.downloads.onDeterminingFilename.addListener>[0] = (
    downloadItem,
    suggest
  ) => {
    if (downloadItem.byExtensionName !== EXTENSION_NAME) return;
    const { id } = downloadItem;
    let { filename } = downloadItem;
    const name = filename.substring(0, filename.lastIndexOf('.') + 1);
    const fileType = filename.substring(filename.lastIndexOf('.') + 1);
    // Metadata.
    if (fileType === 'txt') {
      const { url } = downloadItem;
      // 'name' is the first key of info file.
      const isInfoFile = url.substring(url.indexOf(',') + 1).startsWith('name');
      filename = configRef.current.intermediateDownloadPath + '/' + isInfoFile ? 'info.txt' : 'tags.txt';
    } else {
      filename = `${configRef.current.intermediateDownloadPath}/${configRef.current.fileNameRule.replace('[index]', String(imageIdMapRef.current.get(id))).replace('[name]', name)}.${fileType}`;
    }
    suggest({
      filename: `${filename}`,
      conflictAction: configRef.current.filenameConflictAction,
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
        return <Spinner size="md" color="secondary" />;
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
        return 'Download success';
      case StatusEnum.Fail:
        return 'Failed to fetch data from the server, please retry later.';
    }
  };
  const progress = (
    <>
      <div className="flex">
        {finishedList.length > 0 && (
          <div className="flex flex-col items-center justify-center">
            <div>Finished /</div>
            <div>{finishedList.length} /</div>
          </div>
        )}
        <div className="flex flex-col items-center justify-center">
          <div>Total Page</div>
          <div>{totalNumImages}</div>
        </div>
      </div>

      {finishedList.length > 0 && finishedList.length === totalNumImages && <div>Congrats! Download completed.</div>}
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
          const { data: responseText } = await axios.get(galleryFrontPageUrl.current).catch(() => ({
            data: '',
          }));
          if (!responseText) {
            setStatus(StatusEnum.Fail);
            return;
          }
          extractNumGalleryPages(responseText);
          galleryInfo = extractGalleryInfo(responseText);
          galleryTags = extractGalleryTags(responseText);
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
    <Card className="h-full w-full" radius="none">
      <CardBody className="items-center">
        <Tabs color="secondary">
          <Tab key="info" title="Info">
            <div className="flex flex-col items-center justify-center gap-4 p-2">
              <div>{renderStatus()}</div>
              {progress}
              <div className="flex flex-col items-center">
                <Button
                  color="primary"
                  hidden={isBtnVisible}
                  className={clsx('mt-4', isBtnVisible && 'hidden')}
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
                  Download Gallery
                </Button>
              </div>
            </div>
          </Tab>
          <Tab key="downloadList" title="DownloadList">
            <DownloadTable downloadList={downloadList} imageIdMap={imageIdMapRef.current} />
          </Tab>
        </Tabs>
      </CardBody>
    </Card>
  );
};

export default withErrorBoundary(
  withSuspense(Popup, <div>Loading ...</div>),
  <div className="flex h-screen items-center justify-center">Something went wrong...</div>
);
