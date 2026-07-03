import { useId } from 'react';
import { motion } from 'framer-motion';

const segmentedIndicatorMotion = {
  type: 'spring',
  visualDuration: 0.25,
  bounce: 0.2,
} as const;

export const SegmentedTabs = <T extends string>({
  items,
  selectedKey,
  onSelectionChange,
  ariaLabel,
  className = '',
  layoutId,
}: {
  items: ReadonlyArray<{ id: T; label: string }>;
  selectedKey: T;
  onSelectionChange: (key: T) => void;
  ariaLabel: string;
  className?: string;
  layoutId?: string;
}) => {
  const generatedId = useId().replace(/:/g, '');
  const indicatorLayoutId = layoutId ?? `eh-segmented-indicator-${generatedId}`;

  return (
    <div className={`eh-segmented ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isSelected = item.id === selectedKey;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-active={isSelected ? 'true' : 'false'}
            className="eh-segmented__item"
            onClick={() => onSelectionChange(item.id)}
          >
            {isSelected ? (
              <motion.span
                layoutId={indicatorLayoutId}
                aria-hidden
                className="eh-segmented__indicator"
                initial={false}
                transition={segmentedIndicatorMotion}
              />
            ) : null}
            <span className="eh-segmented__label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
