import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';

export type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'coral' | 'blue';

const statusPillClass = cva(
  'inline-flex shrink-0 items-center justify-center rounded-full border font-medium leading-snug',
  {
    variants: {
      tone: {
        neutral: 'border-hairline bg-transparent text-muted',
        success: 'border-success/35 bg-success/10 text-success',
        warning: 'border-warning/35 bg-warning/10 text-warning',
        danger: 'border-error/35 bg-error/10 text-error',
        coral:
          'border-[rgb(var(--eh-soft-coral))] bg-[rgb(var(--eh-brand-accent)/0.12)] text-[rgb(var(--eh-coral-deep))]',
        blue: 'border-[rgb(var(--eh-action-blue)/0.35)] bg-[rgb(var(--eh-action-blue)/0.1)] text-[rgb(var(--eh-action-blue))]',
      },
      compact: {
        true: 'min-h-5 px-2 py-0.5 text-[10px]',
        false: 'min-h-6 px-2.5 py-1 text-[11px]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      compact: false,
    },
  }
);

export const StatusPill = ({
  tone = 'neutral',
  children,
  className = '',
  compact = false,
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) => (
  <span className={statusPillClass({ tone, compact, className })}>{children}</span>
);
