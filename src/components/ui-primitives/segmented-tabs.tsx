import { useId } from 'react';
import { motion } from 'framer-motion';

const segmentedIndicatorMotion = {
  type: 'spring',
  visualDuration: 0.2,
  bounce: 0.2,
} as const;

export const SegmentedTabs = <T extends string>({
  items,
  selectedKey,
  onSelectionChange,
  ariaLabel,
  className = '',
  layoutId,
  compact = false,
}: {
  items: ReadonlyArray<{ id: T; label: string }>;
  selectedKey: T;
  onSelectionChange: (key: T) => void;
  ariaLabel: string;
  className?: string;
  layoutId?: string;
  compact?: boolean;
}) => {
  const generatedId = useId().replace(/:/g, '');
  const indicatorLayoutId = layoutId ?? `eh-segmented-indicator-${generatedId}`;

  return (
    <div
      className={[
        'relative inline-flex min-h-9 items-center gap-0.5 overflow-hidden rounded-full border border-[var(--eh-hairline)] bg-transparent p-0.5 [isolation:isolate]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const isSelected = item.id === selectedKey;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-active={isSelected ? 'true' : 'false'}
            className={[
              'relative z-[1] flex h-8 items-center rounded-full px-3 text-xs transition-colors [isolation:isolate]',
              compact ? 'h-7 px-2.5 text-[11px]' : '',
              isSelected
                ? 'text-[rgb(var(--eh-primary-fg))]'
                : 'text-muted hover:bg-[var(--eh-hover-bg)] hover:text-ink',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelectionChange(item.id)}
          >
            {isSelected ? (
              <motion.span
                layoutId={indicatorLayoutId}
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-[rgb(var(--eh-brand-primary-active))]"
                transition={segmentedIndicatorMotion}
              />
            ) : null}
            <span className="relative z-[1]">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
