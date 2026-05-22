import React from 'react';
import { Toaster } from 'sonner';

import { withErrorBoundary, withSuspense } from '@/shared';

const PageLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Toaster
        theme="dark"
        toastOptions={{
          classNames: {
            toast:
              'border border-slate-600/30 bg-slate-800/80 backdrop-blur-sm text-slate-100 shadow-lg',
            title: 'text-slate-100 font-medium',
            description: 'text-slate-300',
            success: 'border-green-600/30 bg-green-900/20',
            error: 'border-red-600/30 bg-red-900/20',
            actionButton: 'bg-slate-700 text-slate-100 hover:bg-slate-600',
            cancelButton: 'bg-slate-800 text-slate-300 hover:bg-slate-700',
            closeButton: 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50',
          },
        }}
      />
      {children}
    </>
  );
};

export const Page = withErrorBoundary(
  withSuspense(PageLayout, <div>Loading ...</div>),
  <div>Something went wrong</div>
);
