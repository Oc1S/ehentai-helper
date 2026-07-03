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
  <div className={`eh-field ${className}`.trim()}>
    {startContent ?? <Search className="size-3.5 text-muted-soft" strokeWidth={1.75} />}
    <input
      type={type}
      inputMode={inputMode}
      aria-label={ariaLabel ?? placeholder}
      placeholder={placeholder}
      value={value}
      className={`eh-field__input ${inputClassName}`.trim()}
      onChange={(event) => onValueChange(event.target.value)}
    />
    {endContent}
    {isClearable && value ? (
      <button
        type="button"
        className="eh-field__clear"
        aria-label="Clear"
        onClick={() => onValueChange('')}
      >
        <X size={13} strokeWidth={1.8} />
      </button>
    ) : null}
  </div>
);
