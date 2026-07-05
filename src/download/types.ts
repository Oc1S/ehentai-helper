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
  /** 重试时复用既有任务，避免把补跑记录拆成一个新任务 */
  taskId?: string;
};

export type DownloadJobMode = 'full' | 'resume' | 'retry';
