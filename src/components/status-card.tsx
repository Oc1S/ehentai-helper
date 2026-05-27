import type { ReactNode } from 'react';

type StatusVariant = 'info' | 'warning' | 'success' | 'error';

const variantStyle: Record<
  StatusVariant,
  {
    ambient: string;
    cardShadow: string;
    border: string;
    iconGlow: string;
    iconRing: string;
    iconText: string;
    glassBg: string;
  }
> = {
  info: {
    ambient: 'bg-primary/10',
    cardShadow: 'shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4)]',
    border: 'border-white/[0.12]',
    iconGlow: 'bg-primary/20',
    iconRing: 'border-white/[0.15] bg-primary/10',
    iconText: 'text-primary',
    glassBg: 'bg-gradient-to-b from-white/[0.08] to-white/[0.02]',
  },
  warning: {
    ambient: 'bg-warning/10',
    cardShadow: 'shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4)]',
    border: 'border-white/[0.12]',
    iconGlow: 'bg-warning/20',
    iconRing: 'border-white/[0.15] bg-warning/10',
    iconText: 'text-warning',
    glassBg: 'bg-gradient-to-b from-white/[0.08] to-white/[0.02]',
  },
  success: {
    ambient: 'bg-success/10',
    cardShadow: 'shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4)]',
    border: 'border-white/[0.12]',
    iconGlow: 'bg-success/20',
    iconRing: 'border-white/[0.15] bg-success/10',
    iconText: 'text-success',
    glassBg: 'bg-gradient-to-b from-white/[0.08] to-white/[0.02]',
  },
  error: {
    ambient: 'bg-error/10',
    cardShadow: 'shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4)]',
    border: 'border-white/[0.12]',
    iconGlow: 'bg-error/20',
    iconRing: 'border-white/[0.15] bg-error/10',
    iconText: 'text-error',
    glassBg: 'bg-gradient-to-b from-white/[0.08] to-white/[0.02]',
  },
};

export const StatusCard = ({
  variant,
  icon,
  title,
  description,
  children,
  embedded = false,
  className = '',
}: {
  variant: StatusVariant;
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  embedded?: boolean;
  className?: string;
}) => {
  const style = variantStyle[variant];

  if (embedded) {
    return (
      <div className={`flex w-full items-start gap-3 rounded-2xl border border-white/[0.04] bg-surface-soft/50 p-3 ${className}`.trim()}>
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border backdrop-blur-md ${style.iconRing} ${style.iconText} [&_svg]:h-5 [&_svg]:w-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]`}
        >
          {icon}
        </div>
        <div className="flex flex-col gap-1 text-left">
          <h3 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h3>
          {description && <div className="text-[11px] leading-relaxed text-muted">{description}</div>}
          {children && <div className="mt-1">{children}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative mx-auto w-full max-w-[400px] overflow-hidden rounded-[24px] border ${style.border} ${style.glassBg} ${style.cardShadow} bg-surface-card/40 p-6 backdrop-blur-xl transition-all hover:border-white/[0.12] hover:shadow-2xl ${className}`.trim()}>
      <div
        className={`absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[80px] transition-transform duration-700 group-hover:scale-110 ${style.ambient}`}
        aria-hidden
      />

      <div className="relative z-10 flex flex-col items-start gap-5">
        <div
          className={`relative flex h-14 w-14 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl ${style.iconRing} ${style.iconText} [&_svg]:h-6 [&_svg]:w-6`}
        >
          {icon}
        </div>

        <div className="flex w-full flex-col gap-2 text-left">
          <h3 className="text-xl font-bold tracking-tight text-ink">{title}</h3>
          {description && (
            <div className="text-[13px] leading-relaxed text-muted">{description}</div>
          )}
          {children && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </div>
  );
};
