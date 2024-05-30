import {
  EXTENSION_NAME,
  PATTERN_GALLERY_PAGE_URL,
  defaultConfig,
  useMounted,
  withErrorBoundary,
  withSuspense,
} from '@chrome-extension-boilerplate/shared';
import { useRef, useState } from 'react';
import { generateTxtFile, removeInvalidCharFromFilename } from './utils';
import { Button } from '@nextui-org/react';
import clsx from 'clsx';

// Gallery information.
let galleryFrontPageUrl = '';
let galleryPageInfo: Record<string, any> = {};
let galleryInfo: Record<string, any> = {};
let galleryTags: Record<string, any> = {};

const isEHentaiUrl = (url: string) => {
  return PATTERN_GALLERY_PAGE_URL.test(url);
};

const Popup = () => {
  const [status, setStatus] = useState<React.ReactNode>('Initializing...');
  const [isBtnDisabled, setIsBtnDisabled] = useState(true);
  const [isBtnHidden, setIsBtnHidden] = useState(true);
  const configRef = useRef(defaultConfig);

  const httpGetAsync = async (url: string, callback: (text: string) => void) => {
    // axios.get(url).then(response => {
    //   callback(response.data);
    // })
    const xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function () {
      if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
        const responseText = xmlHttp.responseText;
        callback(responseText);
      }
    };
    xmlHttp.open('GET', url, true);
    xmlHttp.send(null);
  };

  const htmlToDOM = (html: string, title: string) => {
    const doc = document.implementation.createHTMLDocument(title);
    doc.documentElement.innerHTML = html;
    return doc;
  };

  const extractImagePageUrls = (html: string) => {
    const urls = [];
    const doc = htmlToDOM(html, '');
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
  const processImagePage = (url: string) => {
    httpGetAsync(url, responseText => {
      const doc = htmlToDOM(responseText, '');
      let imageUrl = (doc.getElementById('img') as HTMLImageElement).src;
      if (configRef.current.saveOriginalImages) {
        const originalImage = (doc.getElementById('i7')?.childNodes[3] as HTMLAnchorElement).href;
        imageUrl = originalImage ?? imageUrl;
      }
      chrome.downloads.download({ url: imageUrl });
    });
  };

  /* 获取gallery整页所有图片 */
  const processGalleryPage = (url: string) => {
    httpGetAsync(url, responseText => {
      const imagePageUrls = extractImagePageUrls(responseText);
      processImagePage(imagePageUrls[0]); // Start immediately.
      let imageIndex = 1;
      const imageInterval = setInterval(() => {
        if (imageIndex == imagePageUrls.length) {
          clearInterval(imageInterval);
          return;
        }
        processImagePage(imagePageUrls[imageIndex]);
        imageIndex++;
      }, configRef.current.downloadInterval);
    });
  };

  /** 开启下载图片 */
  const downloadImages = () => {
    processGalleryPage(galleryFrontPageUrl); // Start immediately.
    let pageIndex = 1;
    // 下载该页图片后，继续下载下一页
    const pageInterval = setInterval(() => {
      if (pageIndex === galleryPageInfo.numPages) {
        clearInterval(pageInterval);
        return;
      }
      processGalleryPage(galleryFrontPageUrl + '?p=' + pageIndex);
      pageIndex++;
    }, configRef.current.downloadInterval * galleryPageInfo.numImagesPerPage);
  };

  /** 获取当前tabUrl */
  const getCurrentTabUrl = (callback: (url: string) => void) => {
    chrome.tabs.query(
      {
        active: true,
        currentWindow: true,
      },
      tabs => {
        const [tab] = tabs;
        const { url } = tab;
        if (!url) return callback('');
        callback(url);
      }
    );
  };

  const keyValuePairToString = (key: string, val: string) => {
    const separator = '\t';
    const terminator = '\n';
    return key + separator + val + terminator;
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
    const doc = htmlToDOM(html, '');
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
    const doc = htmlToDOM(html, '');
    const info: Record<string, any> = {};

    const name = doc.getElementById('gn')!.textContent;
    const nameInJapanese = doc.getElementById('gj')!.textContent;
    const category = (doc.getElementById('gdc')!.childNodes[0].childNodes[0] as any).alt;
    const uploader = doc.getElementById('gdn')!.childNodes[0].textContent;
    const gdt2ClassElements = doc.getElementsByClassName('gdt2');
    const posted = gdt2ClassElements[0].textContent;
    const parent = gdt2ClassElements[1].textContent;
    const visible = gdt2ClassElements[2].textContent;
    const language = gdt2ClassElements[3].textContent;
    const originalFileSizeMB = gdt2ClassElements[4].textContent;
    const numImages = gdt2ClassElements[5].textContent;
    const favorited = gdt2ClassElements[6].textContent;
    const ratingTimes = doc.getElementById('rating_count')!.textContent;
    const averageScore = doc.getElementById('rating_label')!.textContent;

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
   * 提取GalleryInfo
   */
  const extractGalleryTags = (html: string) => {
    const doc = htmlToDOM(html, '');
    const taglistElements = doc.getElementById('taglist')!.childNodes[0].childNodes[0].childNodes;
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

  const galleryInfoToString = (info: Record<string, any>) => {
    const str =
      keyValuePairToString('name:', info.name) +
      keyValuePairToString('name (Japanese):', info.nameInJapanese) +
      keyValuePairToString('category:', info.category) +
      keyValuePairToString('uploader:', info.uploader) +
      keyValuePairToString('posted:', info.posted) +
      keyValuePairToString('parent:', info.parent) +
      keyValuePairToString('visible:', info.visible) +
      keyValuePairToString('language:', info.language) +
      keyValuePairToString('original file size (MB):', info.originalFileSizeMB) +
      keyValuePairToString('pages:', info.numImages) +
      keyValuePairToString('favorited:', info.favorited) +
      keyValuePairToString('rating times:', info.ratingTimes) +
      keyValuePairToString('average score:', info.averageScore);
    return str;
  };

  const galleryTagsToString = (tags: Record<string, any>) => {
    let str = '';
    for (const i in tags) {
      str += keyValuePairToString(tags[i].category, tags[i].content);
    }
    return str;
  };

  const fileNameRef = useRef(1);
  useMounted(() => {
    getCurrentTabUrl(url => {
      // On valid page.
      if (isEHentaiUrl(url)) {
        chrome.storage.sync.get(defaultConfig, items => {
          configRef.current = items as typeof configRef.current;
          galleryFrontPageUrl = url.substring(0, url.lastIndexOf('/') + 1);
          httpGetAsync(galleryFrontPageUrl, responseText => {
            galleryPageInfo = extractNumGalleryPages(responseText);
            galleryInfo = extractGalleryInfo(responseText);
            galleryTags = extractGalleryTags(responseText);
            configRef.current.intermediateDownloadPath += removeInvalidCharFromFilename(galleryInfo.name);
            setIsBtnDisabled(false);
            setIsBtnHidden(false);
            setStatus('Ready to download.');
          });
        });
        // Not on valid page.
      } else {
        setIsBtnDisabled(true);
        setIsBtnHidden(true);
        setStatus(
          <>
            Cannot work on the current page. <br />
            Please go to a E-Hentai / ExHentai gallery page.
          </>
        );
      }
    });

    // Save to the corresponding folder and rename files.
    chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
      if (downloadItem.byExtensionName === EXTENSION_NAME) {
        let filename = downloadItem.filename;
        const fileType = filename.substring(filename.lastIndexOf('.') + 1);
        // Metadata.
        if (fileType === 'txt') {
          const { url } = downloadItem;
          // 'name' is the first key of info file.
          const isInfoFile = url.substring(url.indexOf(',') + 1).startsWith('name');
          filename = configRef.current.intermediateDownloadPath + '/' + isInfoFile ? 'info.txt' : 'tags.txt';
        } else {
          filename = configRef.current.intermediateDownloadPath + '/' + (filename || fileNameRef.current++);
        }
        suggest({
          filename: `${filename}`,
          conflictAction: configRef.current.filenameConflictAction,
        });
      }
    });
  });

  return (
    <div className="flex items-center flex-col">
      <h2 className="fixed top-4 text-xl text-primary">{EXTENSION_NAME}</h2>
      <div className="-mt-4">{status}</div>
      <Button
        color="primary"
        disabled={isBtnDisabled}
        hidden={isBtnHidden}
        className={clsx('fixed bottom-4 mt-4', isBtnHidden && 'hidden')}
        onClick={() => {
          setIsBtnDisabled(true);
          setStatus('Please do NOT close the extension popup page before ALL download tasks start.');
          downloadImages();
          if (configRef.current.saveGalleryInfo) {
            generateTxtFile(galleryInfoToString(galleryInfo));
          }
          if (configRef.current.saveGalleryTags) {
            generateTxtFile(galleryTagsToString(galleryTags));
          }
        }}>
        Download Gallery
      </Button>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <div> Loading ... </div>), <div> Error Occur </div>);
