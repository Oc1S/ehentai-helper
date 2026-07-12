import assert from 'node:assert/strict';
import test from 'node:test';

import {
  needsInProgressUpdate,
  resolveOwnedDownloadBinding,
} from '../src/download/download-binding';
import type { DownloadIndexEntry, GalleryRecordsMap } from '../src/storage';

const ownerMap: Record<string, DownloadIndexEntry> = {
  '42': {
    index: 7,
    galleryUrl: 'gallery-a',
    taskId: 'task-a',
    total: 10,
  },
};

const records = (taskId: string): GalleryRecordsMap => ({
  'gallery-a': {
    galleryUrl: 'gallery-a',
    galleryName: 'A',
    galleryId: '1',
    downloadPath: 'A',
    total: 10,
    images: {
      '7': {
        index: 7,
        sourceUrl: 'https://example.test/7.jpg',
        taskId,
        state: 'in_progress',
        updatedAt: 1,
      },
    },
    createdAt: 1,
    updatedAt: 1,
  },
});

test('晚到终态只依赖持久化 owner，不依赖已清除或已切换的活动任务', () => {
  const binding = resolveOwnedDownloadBinding(42, ownerMap, records('task-a'));

  assert.equal(binding?.entry.galleryUrl, 'gallery-a');
  assert.equal(binding?.taskId, 'task-a');
  assert.equal(binding?.needsBind, true);
});

test('旧任务事件不能覆盖同一图片的新任务记录', () => {
  assert.equal(resolveOwnedDownloadBinding(42, ownerMap, records('task-b')), null);
});

test('批次开始即可进入下载中，解析出直链后仍会补写 sourceUrl', () => {
  const image = records('task-a')['gallery-a'].images['7'];
  image.state = 'queued';
  image.sourceUrl = '';
  assert.equal(needsInProgressUpdate(image, 'task-a'), true);

  image.state = 'in_progress';
  assert.equal(needsInProgressUpdate(image, 'task-a'), false);
  assert.equal(needsInProgressUpdate(image, 'task-a', 'https://example.test/7.jpg'), true);
});

test('下载 owner hint 必须持久化完成后才能继续启动 Chrome 下载', async () => {
  let releaseStorageWrite = () => undefined;
  let notifyStorageWriteStarted = () => undefined;
  const storageWriteStarted = new Promise<void>((resolve) => {
    notifyStorageWriteStarted = resolve;
  });
  const storageWriteGate = new Promise<void>((resolve) => {
    releaseStorageWrite = resolve;
  });

  const passiveStorageArea = {
    get: async () => ({}),
    set: async () => undefined,
    onChanged: { addListener: () => undefined },
  };
  globalThis.chrome = {
    storage: {
      local: passiveStorageArea,
      sync: passiveStorageArea,
      session: {
        get: async () => ({}),
        set: async () => {
          notifyStorageWriteStarted();
          await storageWriteGate;
        },
        onChanged: { addListener: () => undefined },
      },
    },
  } as unknown as typeof chrome;

  const { enqueuePendingDownloadFilename } = await import('../src/download/download-filename');
  let persisted = false;
  const enqueue = enqueuePendingDownloadFilename('https://example.test/7.jpg', {
    downloadPath: 'A',
    index: 7,
    total: 10,
    ext: 'jpg',
    sourceUrl: 'https://example.test/7.jpg',
    taskId: 'task-a',
    galleryUrl: 'gallery-a',
  }).then(() => {
    persisted = true;
  });

  await storageWriteStarted;
  assert.equal(persisted, false);

  releaseStorageWrite();
  await enqueue;
  assert.equal(persisted, true);
});
