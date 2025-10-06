import { Card, CardBody, Tab, Tabs } from '@nextui-org/react';
import { Toaster } from 'sonner';

import { Download } from './components/download';
import History from './components/history';
import { Noise } from './components/noise';
import { Page } from './components/page';
import DownloadTable from './components/Table';

const Popup = () => {
  return (
    <Page>
      <Noise />
      <Toaster />
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
    </Page>
  );
};

export default Popup;
