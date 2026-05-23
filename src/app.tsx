import React, { useEffect } from 'react';
import { NextUIProvider } from '@nextui-org/react';
import { Toaster } from 'sonner';

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <NextUIProvider>
      <div className="h-full w-full bg-canvas text-body dark">
        <Toaster theme="dark" />
        {children}
      </div>
    </NextUIProvider>
  );
};
