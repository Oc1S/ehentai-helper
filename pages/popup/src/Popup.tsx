import {
  defaultConfig,
  EXTENSION_NAME,
  getCurrentTabUrl,
  isEHentaiUrl,
  isObject,
  useMounted,
  withErrorBoundary,
  withSuspense,
} from '@ehentai-helper/shared';
import { Button, Link } from '@nextui-org/react';
import axios from 'axios';
import clsx from 'clsx';
import { useRef, useState } from 'react';

import DownloadTable from './components/Table';
import { generateTxtFile, removeInvalidCharFromFilename } from './utils';

// Gallery information.
let galleryPageInfo: Record<string, any> = {};
let galleryInfo: Record<string, any> = {};
let galleryTags: Record<string, any> = {};

/**
 * TODO:
 * 2. 已完成/未完成
 * 3. 重试能力
 */
const Popup = () => {
  const [text, setText] = useState<React.ReactNode>('Initializing...');
  const galleryFrontPageUrl = useRef('');

  const [isBtnDisabled, setIsBtnDisabled] = useState(true);
  const [isBtnHidden, setIsBtnHidden] = useState(true);
  /* alter when mounted */
  const configRef = useRef(defaultConfig);
  const [downloadList, setDownloadList] = useState<chrome.downloads.DownloadItem[]>([]);
  const imageIdMapRef = useRef(new Map<number, number>());

  const htmlStr2DOM = (html: string, title = '') => {
    const doc = document.implementation.createHTMLDocument(title);
    doc.documentElement.innerHTML = html;
    return doc;
  };

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
    if (!res) return pageInfo;
    pageInfo.numImagesPerPage = +res[1];
    pageInfo.totalNumImages = +res[2].replace(',', '');
    if (pageInfo.numImagesPerPage && pageInfo.totalNumImages) {
      pageInfo.numPages = Math.ceil(pageInfo.totalNumImages / pageInfo.numImagesPerPage);
    }
    return pageInfo;
  };

  /**
   * 提取GalleryInfo
   */
  const extractGalleryInfo = (html: string) => {
    const doc = htmlStr2DOM(html);
    const info: Record<string, any> = {};

    const name = doc.getElementById('gn')?.textContent;
    const nameInJapanese = doc.getElementById('gj')?.textContent;
    const category = (doc.getElementById('gdc')?.childNodes[0].childNodes[0] as any).alt;
    const uploader = doc.getElementById('gdn')?.childNodes[0].textContent;
    const gdt2ClassElements = doc.getElementsByClassName('gdt2');
    const posted = gdt2ClassElements[0].textContent;
    const parent = gdt2ClassElements[1].textContent;
    const visible = gdt2ClassElements[2].textContent;
    const language = gdt2ClassElements[3].textContent;
    const originalFileSizeMB = gdt2ClassElements[4].textContent;
    const numImages = gdt2ClassElements[5].textContent;
    const favorited = gdt2ClassElements[6].textContent;
    const ratingTimes = doc.getElementById('rating_count')?.textContent;
    const averageScore = doc.getElementById('rating_label')?.textContent;

    info.name = name ?? '';
    info.nameInJapanese = nameInJapanese ?? '';
    info.category = category ?? '';
    info.uploader = uploader ?? '';
    info.posted = posted ?? '';
    info.parent = parent ?? '';
    info.visible = visible ?? '';
    info.language = language ? language.replace(/\s+/, ' ') : '';
    info.originalFileSizeMB = originalFileSizeMB ? parseFloat(originalFileSizeMB.replace(/(\S+) MB/, '$1')) : 0;
    info.numImages = numImages ? parseInt(numImages.replace(/(\d+) pages/, '$1')) : 0;
    info.favorited = favorited ? parseInt(favorited.replace(/(\d+) times/, '$1')) : 0;
    info.ratingTimes = ratingTimes ? parseInt(ratingTimes) : 0;
    info.averageScore = averageScore ? parseFloat(averageScore.replace(/Average: (\S+)/, '$1')) : 0.0;
    return info;
  };

  /**
   * 提取GalleryTags
   */
  const extractGalleryTags = (html: string) => {
    const doc = htmlStr2DOM(html);
    const taglistElements = doc.getElementById('taglist')?.childNodes?.[0]?.childNodes?.[0]?.childNodes;
    if (taglistElements === undefined) return [];
    const tags = new Array(taglistElements.length);
    for (let i = 0; i < taglistElements.length; i++) {
      const tr = taglistElements[i];
      tags[i] = {
        category: tr.childNodes[0].textContent,
        content: '',
      };
      const tagContentElements = tr.childNodes[1].childNodes;
      for (let j = 0; j < tagContentElements.length; j++) {
        if (j > 0) {
          tags[i].content += ', ';
        }
        tags[i].content += tagContentElements[j].textContent;
      }
    }
    return tags;
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

  useMounted(() => {
    (async () => {
      const url = await getCurrentTabUrl().catch(() => '');
      // On valid page.
      if (isEHentaiUrl(url)) {
        chrome.storage.sync.get(defaultConfig, async items => {
          configRef.current = items as typeof configRef.current;
          galleryFrontPageUrl.current = url.substring(0, url.lastIndexOf('/') + 1);
          const { data: responseText } = await axios.get(galleryFrontPageUrl.current);
          galleryPageInfo = extractNumGalleryPages(responseText);
          galleryInfo = extractGalleryInfo(responseText);
          galleryTags = extractGalleryTags(responseText);
          configRef.current.intermediateDownloadPath += removeInvalidCharFromFilename(galleryInfo.name);
          setIsBtnDisabled(false);
          setIsBtnHidden(false);
          setText('Ready to download');
        });
      }
      // Not on valid page.
      else {
        setIsBtnDisabled(true);
        setIsBtnHidden(true);
        setText(
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
      }
    })();

    chrome.downloads.onCreated.addListener(handleDownloadCreated);
    chrome.downloads.onChanged.addListener(handleDownloadChanged);
    chrome.downloads.onDeterminingFilename.addListener(handleDeterminingFilename);
    return () => {
      chrome.downloads.onCreated.removeListener(handleDownloadCreated);
      chrome.downloads.onChanged.removeListener(handleDownloadChanged);
      chrome.downloads.onDeterminingFilename.removeListener(handleDeterminingFilename);
    };
  });

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2">
      {/* <h2 className="text-primary text-xl">{EXTENSION_NAME}</h2> */}
      <div>{text}</div>

      {downloadList.length > 0 ? (
        <DownloadTable downloadList={downloadList} imageIdMap={imageIdMapRef.current} />
      ) : (
        <Button
          color="primary"
          disabled={isBtnDisabled}
          hidden={isBtnHidden}
          className={clsx('mt-4', isBtnHidden && 'hidden')}
          onClick={() => {
            setIsBtnDisabled(true);
            setText(<>🤗Please do NOT close the extension popup page before ALL download tasks start</>);
            downloadAllImages();
            if (configRef.current.saveGalleryInfo) {
              generateTxtFile(JSON.stringify(galleryInfo, null, 2));
            }
            if (configRef.current.saveGalleryTags) {
              generateTxtFile(JSON.stringify(galleryTags, null, 2));
            }
          }}>
          Download Gallery
        </Button>
      )}
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <div> Loading ... </div>), <div> Error Occur </div>);
