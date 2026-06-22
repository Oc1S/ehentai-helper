export enum StatusEnum {
  Loading = 0,
  OtherPage = 1,
  EHentaiOther = 2,
  Fail = 3,
  BeforeDownload = 4,
  Downloading = 5,
  DownloadSuccess = 6,
  DownloadPartialSuccess = 7,
  DownloadFailed = 8,
}

export const CENTERED_STATUSES = [
  StatusEnum.OtherPage,
  StatusEnum.EHentaiOther,
  StatusEnum.Fail,
] as const;
