import { withErrorBoundary, withSuspense } from '../lib/hoc';

const PageLayout = () => {
  return <div>1</div>;
};

export const Page = withErrorBoundary(
  withSuspense(PageLayout, <div> Loading ... </div>),
  <div> Something went wrong </div>
);
