import type { ReactNode } from 'react';

type StatusVariant = 'info' | 'warning' | 'success' | 'error';

const iconGlass = 'border-[var(--eh-hairline-soft)] bg-transparent backdrop-blur-sm';

const variantAmbient: Record<StatusVariant, string> = {
  info: 'glass-ambient-cyan',
  warning: 'bg-warning/[0.04]',
  success: 'bg-success/[0.04]',
  error: 'bg-error/[0.03]',
};

const cardShell = 'glass-card glass-card-static glass-card-pool';

export const StatusCard = ({
  variant,
  icon,
  title,
  description,
  children,
  className = '',
}: {
  variant: StatusVariant;
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) => {
  const ambient = variantAmbient[variant];

  return (
    <div
      className={`${cardShell} mx-auto w-full max-w-[400px] rounded-eh-3xl p-5 ${className}`.trim()}
    >
      <div className="glass-frost-pool pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="glass-highlight-pool pointer-events-none absolute inset-x-8 top-0 h-px"
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full opacity-70 blur-[80px] ${ambient}`}
        aria-hidden
      />

      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border shadow-none ${iconGlass} ${
            variant === 'warning'
              ? 'text-warning/90'
              : variant === 'success'
                ? 'text-success/90'
                : variant === 'error'
                  ? 'text-error/90'
                  : 'text-muted'
          } [&_svg]:h-6 [&_svg]:w-6`}
        >
          {icon}
        </div>

        <div className="flex w-full flex-col items-center gap-2">
          <h3 className="text-lg font-bold tracking-tight text-ink">{title}</h3>
          {description && (
            <div className="max-w-[300px] text-[13px] leading-relaxed text-muted">
              {description}
            </div>
          )}
          {children && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </div>
  );
};
