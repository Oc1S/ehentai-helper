import type { ReactNode } from 'react';

export const MetaBadge = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center rounded-full border border-hairline bg-surface-soft px-2.5 py-1 text-[11px] font-medium text-muted">
    {children}
  </span>
);
