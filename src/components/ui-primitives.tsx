import type { InputHTMLAttributes, ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

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

export type PillTone = 'neutral' | 'success' | 'warning' | 'danger' | 'coral' | 'blue';

export const StatusPill = ({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}) => <span className={`eh-pill eh-pill--${tone} ${className}`.trim()}>{children}</span>;

export const Spinner = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => (
  <span className={`eh-spinner eh-spinner--${size}`} aria-hidden />
);

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="eh-modal" role="presentation">
      <button type="button" className="eh-modal__scrim" aria-label="Close" onClick={onClose} />
      <section
        className={`eh-modal__panel eh-modal__panel--${size}`}
        role="dialog"
        aria-modal="true"
      >
        {title ? (
          <header className="eh-modal__header">
            <div className="min-w-0 flex-1">{title}</div>
            <button type="button" className="eh-modal__close" aria-label="Close" onClick={onClose}>
              <X size={16} strokeWidth={1.75} />
            </button>
          </header>
        ) : null}
        <div className="eh-modal__body scrollbar-glass">{children}</div>
        {footer ? <footer className="eh-modal__footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body
  );
};

export const SegmentedTabs = <T extends string>({
  items,
  selectedKey,
  onSelectionChange,
  ariaLabel,
}: {
  items: { id: T; label: string }[];
  selectedKey: T;
  onSelectionChange: (key: T) => void;
  ariaLabel: string;
}) => (
  <div className="eh-segmented" role="tablist" aria-label={ariaLabel}>
    {items.map((item) => {
      const isSelected = item.id === selectedKey;
      return (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={isSelected}
          className={`eh-segmented__item ${isSelected ? 'eh-segmented__item--active' : ''}`}
          onClick={() => onSelectionChange(item.id)}
        >
          {item.label}
        </button>
      );
    })}
  </div>
);

export const PaginationControls = ({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) => {
  const safeTotal = Math.max(1, total);

  return (
    <div className="eh-pagination" aria-label="Pagination">
      <button
        type="button"
        className="eh-pagination__button"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        aria-label="Previous page"
      >
        <ChevronLeft size={14} strokeWidth={1.8} />
      </button>
      <span className="eh-pagination__label">
        {page} / {safeTotal}
      </span>
      <button
        type="button"
        className="eh-pagination__button"
        disabled={page >= safeTotal}
        onClick={() => onChange(Math.min(safeTotal, page + 1))}
        aria-label="Next page"
      >
        <ChevronRight size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
};

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
      {checked ? <Check size={13} strokeWidth={2} /> : null}
    </span>
    {label ? <span className="eh-check__label">{label}</span> : null}
  </label>
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
