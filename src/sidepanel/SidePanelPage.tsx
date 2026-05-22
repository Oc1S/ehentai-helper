import { Button } from '@nextui-org/react';
import { useState } from 'react';

import { AppShell } from '@/app';
import { useStorageSuspense, withErrorBoundary, withSuspense } from '@/shared';
import { exampleThemeStorage } from '@/storage';

const SidePanelLayout = () => {
  const theme = useStorageSuspense(exampleThemeStorage);
  const [, setTick] = useState(0);

  return (
    <AppShell>
      <div
        className="flex h-screen w-full flex-col items-center justify-center gap-4"
        style={{
          backgroundColor: theme === 'light' ? '#eee' : '#222',
        }}
      >
        <img src={chrome.runtime.getURL('icon.png')} className="h-24 w-24" alt="logo" />
        <Button onPress={exampleThemeStorage.toggle}>Toggle theme</Button>
        <Button variant="flat" onPress={() => setTick((t) => t + 1)}>
          Refresh
        </Button>
      </div>
    </AppShell>
  );
};

export const SidePanelPage = withErrorBoundary(
  withSuspense(SidePanelLayout, <div> Loading ... </div>),
  <div> Error Occur </div>
);
