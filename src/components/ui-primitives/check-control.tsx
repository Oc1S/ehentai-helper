import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

export const CheckControl = ({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
}) => (
  <label className="inline-flex min-h-5 cursor-pointer items-center gap-2 text-sm leading-5 text-body">
    <input
      type="checkbox"
      checked={checked}
      className="sr-only"
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
    <span
      className={[
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-eh-xs border text-primary-foreground transition-colors',
        checked
          ? 'border-[rgb(var(--eh-brand-primary))] bg-[rgb(var(--eh-brand-primary))]'
          : 'border-[var(--eh-hairline)] bg-transparent',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden
    >
      <Check
        className={`h-[13px] w-[13px] shrink-0 transition-opacity ${
          checked ? 'opacity-100' : 'opacity-0'
        }`}
        size={13}
        strokeWidth={2}
      />
    </span>
    {label ? <span className="text-sm text-body">{label}</span> : null}
  </label>
);
