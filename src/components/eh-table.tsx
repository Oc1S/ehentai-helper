import type { ReactNode } from 'react';

export const EhTableFrame = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={[
      'scrollbar-glass min-h-0 flex-1 overflow-auto rounded-eh-sm border border-[var(--eh-hairline)] bg-transparent',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {children}
  </div>
);
