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
  <label className="eh-check">
    <input
      type="checkbox"
      checked={checked}
      className="sr-only"
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
    <span className="eh-check__box" aria-hidden>
      <Check className="eh-check__mark" size={13} strokeWidth={2} />
    </span>
    {label ? <span className="eh-check__label">{label}</span> : null}
  </label>
);
