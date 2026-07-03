import React from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <MotionConfig reducedMotion="user">
      <Tooltip.Provider delay={320} closeDelay={80}>
        <div className="h-full w-full bg-transparent text-body">
          <Toaster
            theme="light"
            position="bottom-right"
            offset={{ bottom: 18, right: 16 }}
            richColors
            toastOptions={{
              duration: 3000,
              style: {
                background: 'rgb(var(--eh-canvas))',
                border: '1px solid var(--eh-hairline)',
                color: 'rgb(var(--eh-body))',
                boxShadow: 'var(--eh-shadow-card-elevated)',
              },
              classNames: {
                title: '!text-ink',
                description: '!text-muted',
              },
            }}
          />
          {children}
        </div>
      </Tooltip.Provider>
    </MotionConfig>
  );
};
