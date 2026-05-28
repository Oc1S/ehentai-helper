import { type Config, DEFAULT_CONFIG } from '../shared/constant';
import type { BaseStorage } from './base';
import { createStorage, StorageType } from './base';

export const configStorage: BaseStorage<Config> = createStorage<Config>(
  'ehentai-helper-config',
  DEFAULT_CONFIG,
  {
    storageType: StorageType.Sync,
    liveUpdate: true,
  }
);
