import type { ReactNode } from 'react';
import type { TableProps } from '@nextui-org/react';

type EhTableClassNames = NonNullable<TableProps['classNames']>;

const mergeSlot = (base?: string, extra?: string) => [base, extra].filter(Boolean).join(' ');

const EH_TABLE_CLASS_NAMES: EhTableClassNames = {
  base: 'min-h-0 w-full',
  table: 'min-w-full',
  thead: '[&>tr]:first:shadow-none',
  tr: 'border-b border-[var(--eh-hairline-soft)] last:border-b-0 transition-colors data-[hover=true]:bg-[rgb(var(--eh-brand-accent)/0.06)]',
  th: 'sticky top-0 z-10 h-8 border-b border-[var(--eh-hairline-soft)] bg-[rgb(12_12_13/0.72)] text-[11px] font-medium uppercase tracking-wide text-muted-soft first:rounded-tl-lg last:rounded-tr-lg',
  td: 'py-2 text-xs',
  emptyWrapper: 'py-10 text-xs text-muted-soft',
};

export const EhTableFrame = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={mergeSlot(
      'scrollbar-glass min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--eh-glass-border)] bg-[rgb(8_8_9/0.28)] shadow-[var(--eh-glass-inset)]',
      className
    )}
  >
    {children}
  </div>
);

export const ehTableClassNames = (overrides?: Partial<EhTableClassNames>): EhTableClassNames => {
  if (!overrides) return EH_TABLE_CLASS_NAMES;

  const keys = new Set([
    ...Object.keys(EH_TABLE_CLASS_NAMES),
    ...Object.keys(overrides),
  ]) as Set<keyof EhTableClassNames>;

  const merged = { ...EH_TABLE_CLASS_NAMES };
  for (const key of keys) {
    const base = EH_TABLE_CLASS_NAMES[key];
    const extra = overrides[key];
    if (typeof base === 'string' || typeof extra === 'string') {
      merged[key] = mergeSlot(
        typeof base === 'string' ? base : undefined,
        typeof extra === 'string' ? extra : undefined
      );
    }
  }
  return merged;
};
