import React from 'react';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <MotionConfig reducedMotion="user">
      <div className="h-full w-full bg-transparent text-body">
        <Toaster
          theme="light"
          position="bottom-right"
          offset={{ bottom: 80, right: 16 }}
          closeButton
          richColors
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--eh-surface-card-hex)',
              border: '1px solid var(--eh-hairline)',
              color: 'var(--eh-body-hex)',
              boxShadow: 'var(--eh-shadow-card-elevated)',
            },
            classNames: {
              title: '!text-ink',
              description: '!text-muted',
              closeButton: '!border-hairline !bg-surface-soft !text-muted hover:!text-ink',
            },
          }}
        />
        {children}
      </div>
    </MotionConfig>
  );
};
