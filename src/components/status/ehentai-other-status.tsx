import { StatusCard } from '../status-card';
import { InfoIcon } from './icons';

export const EHentaiOtherStatus = () => (
  <StatusCard
    variant="warning"
    icon={<InfoIcon />}
    title="Non-gallery Page Detected"
    description="Navigate to a gallery page to start downloading"
  />
);
