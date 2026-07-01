import type { ReactNode } from 'react';

const mergeSlot = (base?: string, extra?: string) => [base, extra].filter(Boolean).join(' ');

export const EhTableFrame = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={mergeSlot(
      'eh-table-frame scrollbar-glass',
      className
    )}
  >
    {children}
  </div>
);
