import type { ReactNode } from 'react';

export type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'coral' | 'blue';

export const StatusPill = ({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}) => <span className={`eh-pill eh-pill--${tone} ${className}`.trim()}>{children}</span>;
