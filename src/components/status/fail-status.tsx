import { StatusCard } from '../status-card';
import { CloseIcon } from './icons';

export const FailStatus = () => (
  <StatusCard
    variant="error"
    icon={<CloseIcon />}
    title="Connection Failed"
    description="Unable to fetch data from server. Please try again later."
  />
);
