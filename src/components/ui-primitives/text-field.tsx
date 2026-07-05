import type { InputHTMLAttributes, ReactNode } from 'react';
import { Search, X } from 'lucide-react';

type TextFieldProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  startContent?: ReactNode;
  endContent?: ReactNode;
  isClearable?: boolean;
  ariaLabel?: string;
  type?: InputHTMLAttributes<HTMLInputElement>['type'];
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
};

export const TextField = ({
  value,
  onValueChange,
  placeholder,
  className = '',
  inputClassName = '',
  startContent,
  endContent,
  isClearable = false,
  ariaLabel,
  type = 'text',
  inputMode,
}: TextFieldProps) => (
  <div
    className={[
      'flex h-9 min-w-0 items-center gap-2 rounded-eh-sm border border-[var(--eh-hairline)] bg-transparent px-3 transition-colors focus-within:border-[rgb(var(--eh-brand-primary-active))]',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {startContent ?? <Search className="size-3.5 text-muted-soft" strokeWidth={1.75} />}
    <input
      type={type}
      inputMode={inputMode}
      aria-label={ariaLabel ?? placeholder}
      placeholder={placeholder}
      value={value}
      className={[
        'min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-ink outline-none placeholder:text-muted-soft',
        inputClassName,
      ]
        .filter(Boolean)
        .join(' ')}
      onChange={(event) => onValueChange(event.target.value)}
    />
    {endContent}
    {isClearable && value ? (
      <button
        type="button"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-[var(--eh-hover-bg)] hover:text-ink"
        aria-label="Clear"
        onClick={() => onValueChange('')}
      >
        <X size={13} strokeWidth={1.8} />
      </button>
    ) : null}
  </div>
);
