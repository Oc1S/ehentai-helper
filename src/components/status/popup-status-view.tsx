import { StatusEnum } from '../../popup/status';

import { BeforeDownloadStatus } from './before-download-status';
import { DownloadingStatus } from './downloading-status';
import { DownloadSuccessStatus } from './download-success-status';
import { EHentaiOtherStatus } from './ehentai-other-status';
import { FailStatus } from './fail-status';
import { LoadingStatus } from './loading-status';
import { OtherPageStatus } from './other-page-status';

export const PopupStatusView = ({
  status,
  galleryTitle,
  galleryPageInfo,
  range,
  setRange,
  downloadCount,
  finishedCount,
  onDownload,
}: {
  status: StatusEnum;
  galleryTitle: string;
  galleryPageInfo: { numPages: number; totalImages: number };
  range: [number, number];
  setRange: (range: [number, number]) => void;
  downloadCount: number;
  finishedCount: number;
  onDownload: () => void;
}) => {
  switch (status) {
    case StatusEnum.Loading:
      return <LoadingStatus />;
    case StatusEnum.EHentaiOther:
      return <EHentaiOtherStatus />;
    case StatusEnum.OtherPage:
      return <OtherPageStatus />;
    case StatusEnum.BeforeDownload:
      return (
        <BeforeDownloadStatus
          galleryTitle={galleryTitle}
          totalImages={galleryPageInfo.totalImages}
          numPages={galleryPageInfo.numPages}
          range={range}
          setRange={setRange}
          downloadCount={downloadCount}
          onDownload={onDownload}
        />
      );
    case StatusEnum.Downloading:
      return (
        <DownloadingStatus
          galleryTitle={galleryTitle}
          downloadCount={downloadCount}
          finishedCount={finishedCount}
        />
      );
    case StatusEnum.DownloadSuccess:
      return (
        <DownloadSuccessStatus
          galleryTitle={galleryTitle}
          downloadCount={downloadCount}
          finishedCount={finishedCount}
        />
      );
    case StatusEnum.Fail:
      return <FailStatus />;
    default:
      return <LoadingStatus />;
  }
};
