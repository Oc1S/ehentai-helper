import { BaseStorage, createStorage, StorageType } from './base';
import { defaultConfig, type Config } from '../shared/constant';

export { defaultConfig, type Config } from '../shared/constant';

export const configStorage: BaseStorage<Config> = createStorage<Config>(
  'ehentai-helper-config',
  defaultConfig,
  {
    storageType: StorageType.Sync,
    liveUpdate: true,
  }
);
