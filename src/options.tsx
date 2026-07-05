import './styles/index.css';
import './styles/options.css';

import { withErrorBoundary } from '@/components/hoc';

import { OptionsPage } from './options/options-page';

const OptionsErrorFallback = (
  <div className="flex min-h-screen items-center justify-center bg-canvas p-6 text-center text-body">
    <div className="max-w-[360px] rounded-eh-sm border border-hairline p-5">
      <p className="text-sm font-medium text-ink">E-Hentai Helper</p>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Something went wrong. Please refresh this page.
      </p>
    </div>
  </div>
);

export default withErrorBoundary(OptionsPage, OptionsErrorFallback);
