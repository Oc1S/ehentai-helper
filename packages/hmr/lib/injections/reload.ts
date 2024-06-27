import initClient from '../initClient';

function addReload() {
  const reload = () => {
    // @ts-ignore
    chrome.runtime.reload();
  };

  initClient({
    // @ts-ignore
    id: __HMR_ID,
    onUpdate: reload,
  });
}

addReload();
