import React from 'react';
import { withErrorBoundary, withSuspense } from '@ehentai-helper/shared';
import { Toaster } from 'sonner';

const PageLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Toaster />
      {children}
    </>
  );
};

export const Page = withErrorBoundary(
  withSuspense(PageLayout, <div>Loading ...</div>),
  <div>Something went wrong</div>
);
