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
            style={{ ['--width' as string]: '240px' }}
            toastOptions={{
              duration: 3000,
              style: {
                width: 'var(--width)',
                padding: '8px 12px',
                fontSize: '12px',
                gap: '8px',
                background: 'rgb(var(--eh-brand-primary))',
                border: '1px solid rgb(var(--eh-primary-fg) / 0.14)',
                color: 'rgb(var(--eh-primary-fg))',
                boxShadow: 'var(--eh-shadow-card-elevated)',
              },
              classNames: {
                toast: '!min-h-0',
                title: '!text-[12px] !font-medium !leading-snug !text-[rgb(var(--eh-primary-fg))]',
                description: '!text-[11px] !leading-snug !text-[rgb(var(--eh-primary-fg)/0.72)]',
                icon: '!h-4 !w-4 !m-0',
              },
            }}
          />
          {children}
        </div>
      </Tooltip.Provider>
    </MotionConfig>
  );
};
