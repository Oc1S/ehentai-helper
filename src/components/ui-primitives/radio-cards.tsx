import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';

const radioCardClass = cva(
  'inline-flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition-colors',
  {
    variants: {
      selected: {
        false:
          'border-hairline bg-transparent text-muted hover:border-hairline hover:bg-[var(--eh-hover-bg)] hover:text-ink',
        true: 'border-brand-primary bg-brand-primary text-primary-foreground hover:border-brand-primary-active hover:bg-brand-primary-active hover:text-primary-foreground',
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

export const RadioCards = <T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: ReactNode }[];
}) => (
  <div className="flex flex-wrap gap-2" role="radiogroup">
    {items.map((item) => {
      const isSelected = item.value === value;
      return (
        <label key={item.value} className={radioCardClass({ selected: isSelected })}>
          <input
            type="radio"
            checked={isSelected}
            value={item.value}
            className="sr-only"
            onChange={() => onChange(item.value)}
          />
          <span
            className={`h-2 w-2 rounded-full border border-current ${isSelected ? 'bg-current' : ''}`}
            aria-hidden
          />
          <span>{item.label}</span>
        </label>
      );
    })}
  </div>
);
