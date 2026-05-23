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
  <div className={`${cardClass[variant]} ${className}`.trim()}>
    <div className={iconClass[variant]}>{icon}</div>
    <div className="w-full space-y-2 text-center">
      <h3 className="status-title">{title}</h3>
      {description && <div className="status-desc">{description}</div>}
      {children}
    </div>
  </div>
);
