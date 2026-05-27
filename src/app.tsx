import React from 'react';
import { NextUIProvider } from '@nextui-org/react';
import { Toaster } from 'sonner';

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <NextUIProvider>
      <div className="h-full w-full bg-canvas text-body dark">
        <Toaster
          theme="dark"
          position="top-center"
          closeButton
          richColors
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--eh-surface-card-hex)',
              border: '1px solid var(--eh-hairline)',
              color: 'var(--eh-body-hex)',
            },
            classNames: {
              toast: '!shadow-card',
              title: '!text-ink',
              description: '!text-muted',
              closeButton: '!border-hairline !bg-surface-soft !text-muted hover:!text-ink',
            },
          }}
        />
        {children}
      </div>
    </NextUIProvider>
  );
};
