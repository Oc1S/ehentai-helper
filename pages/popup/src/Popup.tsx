import { withErrorBoundary, withSuspense } from '@ehentai-helper/shared';
import { Card, CardBody, Tab, Tabs } from '@nextui-org/react';

import { Download } from './components/download';
import History from './components/history';
import { Noise } from './components/noise';
import DownloadTable from './components/Table';

const Popup = () => {
  return (
    <>
      <Noise />
      <Card className="h-full w-full" radius="none">
        <CardBody className="items-center">
          <Tabs destroyInactiveTabPanel={false} color="default">
            <Tab key="info" title="Info">
              <Download />
            </Tab>
            <Tab key="downloadList" title="DownloadList">
              <DownloadTable />
            </Tab>
            <Tab key="history" title="History">
              <History />
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </>
  );
};

export default withErrorBoundary(
  withSuspense(Popup, <div>Loading ...</div>),
  <div className="flex h-screen items-center justify-center">Something went wrong...</div>
);
