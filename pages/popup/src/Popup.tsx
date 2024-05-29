import '@src/Popup.css';
import { withErrorBoundary, withSuspense } from '@chrome-extension-boilerplate/shared';
import { useEffect, useState } from 'react';

const EXTENSION_NAME = 'E-Hentai Helper';
const PATTERN_GALLERY_PAGE_URL = /https?:\/\/e[-x]hentai.org\/g\/*/;
const PATTERN_IMAGE_PAGE_URL = /https?:\/\/e[-x]hentai.org\/s\/*/;
const PATTERN_INVALID_FILENAME_CHAR = /[\\/:*?"<>|.~]/g;

// Default config.
const DEFAULT_INTERMEDIATE_DOWNLOAD_PATH = 'e-hentai helper/';
const DEFAULT_SAVE_ORIGINAL_IMAGES = false;
const DEFAULT_SAVE_GALLERY_INFO = false;
const DEFAULT_SAVE_GALLERY_TAGS = false;
const DEFAULT_FILENAME_CONFLICT_ACTION = 'uniquify';
const DEFAULT_DOWNLOAD_INTERVAL = 300; // In ms.

// User's config.
let intermediateDownloadPath = DEFAULT_INTERMEDIATE_DOWNLOAD_PATH;
let saveOriginalImages = DEFAULT_SAVE_ORIGINAL_IMAGES;
let saveGalleryInfo = DEFAULT_SAVE_GALLERY_INFO;
let saveGalleryTags = DEFAULT_SAVE_GALLERY_TAGS;
let filenameConflictAction = DEFAULT_FILENAME_CONFLICT_ACTION;
let downloadInterval = DEFAULT_DOWNLOAD_INTERVAL;

// Gallery information.
let galleryFrontPageUrl = '';
let galleryPageInfo = {};
let galleryInfo = {};
let galleryTags = {};

// UI control.
let buttonDownload: HTMLElement | null = null;

const isEHentaiUrl = (url: string) => {
  return PATTERN_GALLERY_PAGE_URL.test(url);
};

const downloadImages = () => {
  processGalleryPage(galleryFrontPageUrl); // Start immediately.
  let pageIndex = 1;
  const pageInterval = setInterval(() => {
    if (pageIndex == galleryPageInfo.numPages) {
      clearInterval(pageInterval);
      return;
    }
    const galleryPageUrl = galleryFrontPageUrl + '?p=' + pageIndex;
    processGalleryPage(galleryPageUrl);
    pageIndex++;
  }, downloadInterval * galleryPageInfo.numImagesPerPage);
};

const Popup = () => {
  const [status, setStatus] = useState('');
  const [isBtnDisabled, setIsBtnDisabled] = useState(true);
  const [isBtnHidden, setIsBtnHidden] = useState(true);

  // Basic Utils ================================================================

  const getCurrentTabUrl = (callback: (url: string) => void) => {
    const queryInfo = {
      active: true,
      currentWindow: true,
    };
    chrome.tabs.query(queryInfo, tabs => {
      const [tab] = tabs;
      const { url } = tab;
      if (!url) return;
      callback(url);
    });
  };

  const httpGetAsync = (url: string, callback: (text: string) => void) => {
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

  function htmlToDOM(html: string, title: string) {
    const doc = document.implementation.createHTMLDocument(title);
    doc.documentElement.innerHTML = html;
    return doc;
  }

  function keyValuePairToString(key, val) {
    const separator = '\t';
    const terminator = '\n';
    return key + separator + val + terminator;
  }

  // Business logic =============================================================

  function extractNumGalleryPages(html: string) {
    const pageInfo = {
      numImagesPerPage: 0,
      totalNumImages: 0,
      numPages: 0,
    };
    const doc = htmlToDOM(html, '');
    const elements = doc.getElementsByClassName('gpc');
    const pageInfoStr = elements[0].innerHTML;
    const patternImageNumbers = /Showing 1 - (\d+) of (\d*,*\d+) images/;
    patternImageNumbers.exec(pageInfoStr);
    pageInfo.numImagesPerPage = RegExp.$1;
    pageInfo.totalNumImages = RegExp.$2.replace(',', '');
    if (pageInfo.numImagesPerPage != null && pageInfo.totalNumImages != null) {
      pageInfo.numPages = Math.ceil(parseInt(pageInfo.totalNumImages) / parseInt(pageInfo.numImagesPerPage));
    }
    return pageInfo;
  }

  function extractGalleryInfo(html: string) {
    const doc = htmlToDOM(html, '');
    const info = {};

    const name = doc.getElementById('gn').textContent;
    const nameInJapanese = doc.getElementById('gj').textContent;
    const category = doc.getElementById('gdc').childNodes[0].childNodes[0].alt;
    const uploader = doc.getElementById('gdn').childNodes[0].textContent;
    const gdt2ClassElements = doc.getElementsByClassName('gdt2');
    const posted = gdt2ClassElements[0].textContent;
    const parent = gdt2ClassElements[1].textContent;
    const visible = gdt2ClassElements[2].textContent;
    const language = gdt2ClassElements[3].textContent;
    const originalFileSizeMB = gdt2ClassElements[4].textContent;
    const numImages = gdt2ClassElements[5].textContent;
    const favorited = gdt2ClassElements[6].textContent;
    const ratingTimes = doc.getElementById('rating_count').textContent;
    const averageScore = doc.getElementById('rating_label').textContent;

    info.name = name != null ? name : '';
    info.nameInJapanese = nameInJapanese != null ? nameInJapanese : '';
    info.category = category != null ? category : '';
    info.uploader = uploader != null ? uploader : '';
    info.posted = posted != null ? posted : '';
    info.parent = parent != null ? parent : '';
    info.visible = visible != null ? visible : '';
    info.language = language != null ? language.replace(/\s+/, ' ') : '';
    info.originalFileSizeMB =
      originalFileSizeMB != null ? parseFloat(originalFileSizeMB.replace(/(\S+) MB/, '$1')) : 0.0;
    info.numImages = numImages != null ? parseInt(numImages.replace(/(\d+) pages/, '$1')) : 0;
    info.favorited = favorited != null ? parseInt(favorited.replace(/(\d+) times/, '$1')) : 0;
    info.ratingTimes = ratingTimes != null ? parseInt(ratingTimes) : 0;
    info.averageScore = averageScore != null ? parseFloat(averageScore.replace(/Average: (\S+)/, '$1')) : 0.0;
    return info;
  }

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

  const extractGalleryTags = (html: string) => {
    const doc = htmlToDOM(html, '');
    const taglistElements = doc.getElementById('taglist').childNodes[0].childNodes[0].childNodes;
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

  const galleryTagsToString = (tags: Record<string, any>) => {
    let str = '';
    for (const i in tags) {
      str += keyValuePairToString(tags[i].category, tags[i].content);
    }
    return str;
  };

  const extractImagePageUrls = (html: string) => {
    const urls = [];
    const doc = htmlToDOM(html, '');
    // Normal previews.
    let elements = doc.getElementsByClassName('gdtm');
    for (let i = 0; i < elements.length; i++) {
      urls.push(elements[i].childNodes[0].childNodes[0].href);
    }
    // Large previews.
    elements = doc.getElementsByClassName('gdtl');
    for (let i = 0; i < elements.length; i++) {
      urls.push(elements[i].childNodes[0].href);
    }
    return urls;
  };

  const removeInvalidCharFromFilename = (filename: string) => {
    return filename.replace(PATTERN_INVALID_FILENAME_CHAR, ' ').replace(/\s+$/, '');
  };

  const processImagePage = (url: string) => {
    httpGetAsync(url, function (responseText) {
      const doc = htmlToDOM(responseText, '');
      let imageUrl = doc.getElementById('img').src;
      if (saveOriginalImages) {
        const divDownloadOriginal = doc.getElementById('i7');
        if (divDownloadOriginal) {
          imageUrl = divDownloadOriginal.childNodes[3].href;
        }
      }
      chrome.downloads.download({ url: imageUrl });
    });
  };

  const processGalleryPage = (url: string) => {
    httpGetAsync(url, function (responseText) {
      const imagePageUrls = extractImagePageUrls(responseText);
      processImagePage(imagePageUrls[0]); // Start immediately.
      let imageIndex = 1;
      const imageInterval = setInterval(function () {
        if (imageIndex == imagePageUrls.length) {
          clearInterval(imageInterval);
          return;
        }
        processImagePage(imagePageUrls[imageIndex]);
        imageIndex++;
      }, downloadInterval);
    });
  };

  const generateTxtFile = (text: string) => {
    chrome.downloads.download({
      url: 'data:text;charset=utf-8,' + encodeURI(text),
    });
  };

  // Save to the corresponding folder and rename files.
  chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    if (downloadItem.byExtensionName === EXTENSION_NAME) {
      let filename = downloadItem.filename;
      const fileType = filename.substring(filename.lastIndexOf('.') + 1);
      if (fileType == 'txt') {
        // Metadata.
        const url = downloadItem.url;
        // 'name' is the first key of info file.
        const isInfoFile = url.substring(url.indexOf(',') + 1).startsWith('name');
        filename = isInfoFile ? 'info.txt' : 'tags.txt';
      }
      filename = intermediateDownloadPath + '/' + filename;
      suggest({
        filename: filename,
        conflictAction: filenameConflictAction,
      });
    }
  });

  // UI control =================================================================

  const showDefaultDownloadFolder = () => {
    chrome.downloads.showDefaultFolder();
  };

  const buttonDownloadClick = () => {
    setIsBtnDisabled(true);
    setStatus('Please do NOT close the extension popup page ' + 'before ALL download tasks start.');
    downloadImages();
    if (saveGalleryInfo) {
      generateTxtFile(galleryInfoToString(galleryInfo));
    }
    if (saveGalleryTags) {
      generateTxtFile(galleryTagsToString(galleryTags));
    }
  };

  useEffect(() => {
    setStatus('Initializing...');

    buttonDownload = document.getElementById('download');

    chrome.storage.sync.get(
      {
        // Load config.
        intermediateDownloadPath: DEFAULT_INTERMEDIATE_DOWNLOAD_PATH,
        saveOriginalImages: DEFAULT_SAVE_ORIGINAL_IMAGES,
        saveGalleryInfo: DEFAULT_SAVE_GALLERY_INFO,
        saveGalleryTags: DEFAULT_SAVE_GALLERY_TAGS,
        filenameConflictAction: DEFAULT_FILENAME_CONFLICT_ACTION,
        downloadInterval: DEFAULT_DOWNLOAD_INTERVAL,
      },
      items => {
        intermediateDownloadPath = items.intermediateDownloadPath;
        saveOriginalImages = items.saveOriginalImages;
        saveGalleryInfo = items.saveGalleryInfo;
        saveGalleryTags = items.saveGalleryTags;
        filenameConflictAction = items.filenameConflictAction;
        downloadInterval = items.downloadInterval;

        getCurrentTabUrl((url: string) => {
          if (isEHentaiUrl(url)) {
            // On valid page.
            galleryFrontPageUrl = url.substring(0, url.lastIndexOf('/') + 1);
            httpGetAsync(galleryFrontPageUrl, function (responseText) {
              galleryPageInfo = extractNumGalleryPages(responseText);
              galleryInfo = extractGalleryInfo(responseText);
              galleryTags = extractGalleryTags(responseText);
              intermediateDownloadPath += removeInvalidCharFromFilename(galleryInfo.name);

              setIsBtnHidden(false);
              setIsBtnDisabled(false);
              setStatus('Ready to download.');
            });
          } else {
            // Not on valid page.
            setIsBtnHidden(true);
            setIsBtnDisabled(true);
            setStatus('Cannot work on the current page. ' + 'Please go to a E-Hentai / ExHentai gallery page.');
          }
        });
      }
    );
  }, []);

  return (
    <div
      style={{
        width: '200px',
      }}>
      <h2>E-Hentai Helper</h2>
      <button
        id="download"
        disabled={isBtnDisabled}
        hidden={isBtnHidden}
        style={{ margin: '0 0 10px 0;' }}
        onClick={buttonDownloadClick}>
        Download Gallery
      </button>
      <div id="status" />
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <div> Loading ... </div>), <div> Error Occur </div>);
