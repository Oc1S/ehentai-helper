import '@src/Popup.css';
import { withErrorBoundary, withSuspense } from '@chrome-extension-boilerplate/shared';

const Popup = () => {
  return (
    <div
      style={{
        width: '200px',
      }}>
      <h2>E-Hentai Helper</h2>
      <button id="download" disabled hidden style={{ margin: '0 0 10px 0;' }}>
        Download Gallery
      </button>
      <div id="status" />
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <div> Loading ... </div>), <div> Error Occur </div>);
