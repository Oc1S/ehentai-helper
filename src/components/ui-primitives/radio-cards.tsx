import type { ReactNode } from 'react';

export const RadioCards = <T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: ReactNode }[];
}) => (
  <div className="eh-radio-cards" role="radiogroup">
    {items.map((item) => {
      const isSelected = item.value === value;
      return (
        <label
          key={item.value}
          className={`eh-radio-card ${isSelected ? 'eh-radio-card--active' : ''}`}
        >
          <input
            type="radio"
            checked={isSelected}
            value={item.value}
            className="sr-only"
            onChange={() => onChange(item.value)}
          />
          <span className="eh-radio-card__dot" aria-hidden />
          <span>{item.label}</span>
        </label>
      );
    })}
  </div>
);
