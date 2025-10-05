import { Settings, withErrorBoundary, withSuspense } from '@ehentai-helper/shared';
import { Toaster } from 'sonner';

const OptionsPage = () => {
  return (
    <>
      <Toaster />
      <Settings />
    </>
  );
};

export default withErrorBoundary(
  withSuspense(OptionsPage, <div> Loading ... </div>),
  <div> Something went wrong </div>
);
