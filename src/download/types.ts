export type DownloadJobPayload = {
  galleryFrontPageUrl: string;
  galleryName: string;
  galleryId: string;
  downloadPath: string;
  rangeStart: number;
  rangeEnd: number;
  imagesPerPage: number;
  numPages: number;
  totalImages: number;
  /** 仅下载指定序号；缺省为范围内全部 */
  indices?: number[];
};

export type DownloadJobMode = 'full' | 'resume' | 'retry';
