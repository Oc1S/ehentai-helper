import type { ReactNode } from 'react';

export const EhSectionLabel = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => (
  <p className={['text-xs font-medium tracking-normal text-ink', className].filter(Boolean).join(' ')}>
    {children}
  </p>
);
