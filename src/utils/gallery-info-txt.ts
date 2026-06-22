import type { GalleryInfo } from '@/storage';

const line = (label: string, value: string | number | undefined | null) => {
  const v = value === undefined || value === null || value === '' ? '—' : String(value);
  return `${label}: ${v}`;
};

export const formatGalleryInfoTxt = (info: GalleryInfo, galleryUrl?: string): string => {
  const tagBlock =
    info.tags.length > 0
      ? info.tags.map((t) => `  ${t.category}: ${t.content}`).join('\n')
      : '  —';

  return [
    line('Title', info.name),
    line('Title (Japanese)', info.nameInJapanese),
    line('Category', info.category),
    line('Uploader', info.uploader),
    line('Posted', info.posted),
    line('Parent', info.parent),
    line('Visible', info.visible),
    line('Language', info.language),
    line('Pages', info.numImages),
    line('Original file size (MB)', info.originalFileSizeMB),
    line('Rating', `${info.averageScore} (${info.ratingTimes} votes)`),
    line('Favorited', `${info.favorited} times`),
    line('Gallery ID', info.id),
    line('Gallery URL', galleryUrl),
    '',
    'Tags:',
    tagBlock,
    '',
  ].join('\n');
};
