import type { ReactNode } from 'react';

type StatusVariant = 'info' | 'warning' | 'success' | 'error';

const cardClass: Record<StatusVariant, string> = {
  info: 'status-card-info',
  warning: 'status-card-warning',
  success: 'status-card-success',
  error: 'status-card-error',
};

const iconClass: Record<StatusVariant, string> = {
  info: 'icon-circle-info',
  warning: 'icon-circle-warning',
  success: 'icon-circle-success',
  error: 'icon-circle-error',
};

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
}) => (
  <div
    className={`${cardClass[variant]} mx-auto w-full max-w-[400px] px-[18px] py-5 ${className}`.trim()}
  >
    <div className={`${iconClass[variant]} h-10 w-10 [&_svg]:h-5 [&_svg]:w-5`}>{icon}</div>
    <div className="w-full space-y-2 text-center">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <div className="text-xs leading-relaxed text-muted">{description}</div>}
      {children}
    </div>
  </div>
);
