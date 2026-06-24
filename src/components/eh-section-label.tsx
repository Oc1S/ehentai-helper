import type { ReactNode } from 'react';

export const EhSectionLabel = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => (
  <p className={['settings-section-title', className].filter(Boolean).join(' ')}>{children}</p>
);
