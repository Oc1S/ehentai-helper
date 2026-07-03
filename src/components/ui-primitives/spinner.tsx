export const Spinner = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => (
  <span className={`eh-spinner eh-spinner--${size}`} aria-hidden />
);
