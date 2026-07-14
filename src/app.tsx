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
            theme="dark"
            position="bottom-right"
            offset={{ bottom: 18, right: 16 }}
            closeButton={false}
            toastOptions={{
              duration: 3000,
              style: {
                background: 'rgb(var(--eh-brand-primary))',
                border: '1px solid rgb(var(--eh-primary-fg) / 0.14)',
                color: 'rgb(var(--eh-primary-fg))',
                boxShadow: 'var(--eh-shadow-card-elevated)',
              },
              classNames: {
                title: '!text-[rgb(var(--eh-primary-fg))]',
                description: '!text-[rgb(var(--eh-primary-fg)/0.72)]',
              },
            }}
          />
          {children}
        </div>
      </Tooltip.Provider>
    </MotionConfig>
  );
};
