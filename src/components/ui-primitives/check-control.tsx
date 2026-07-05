import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

const checkboxMotion = {
  type: 'spring',
  visualDuration: 0.18,
  bounce: 0,
} as const;

const checkPathMotion = {
  type: 'spring',
  visualDuration: 0.22,
  bounce: 0,
} as const;

export const CheckControl = ({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
}) => (
  <label className="inline-flex min-h-5 cursor-pointer select-none items-center gap-2 text-sm leading-5 text-body">
    <input
      type="checkbox"
      checked={checked}
      className="sr-only"
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
    <motion.span
      className={[
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-eh-xs border text-primary-foreground transition-[background-color,border-color,box-shadow,transform] duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
        checked
          ? 'border-[rgb(var(--eh-brand-primary))] bg-[rgb(var(--eh-brand-primary))]'
          : 'border-[var(--eh-hairline)] bg-transparent hover:bg-[var(--eh-hover-bg)]',
      ]
        .filter(Boolean)
        .join(' ')}
      initial={false}
      animate={{ scale: checked ? 1 : 0.96 }}
      transition={checkboxMotion}
      aria-hidden
    >
      <motion.svg
        className="h-[13px] w-[13px] shrink-0"
        viewBox="0 0 16 16"
        fill="none"
        initial={false}
        animate={checked ? 'checked' : 'unchecked'}
      >
        <motion.path
          d="M3.25 8.35L6.55 11.45L12.75 4.75"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={{
            checked: { opacity: 1, pathLength: 1, scale: 1 },
            unchecked: { opacity: 0, pathLength: 0, scale: 0.92 },
          }}
          transition={checkPathMotion}
        />
      </motion.svg>
    </motion.span>
    {label ? <span className="text-sm text-body">{label}</span> : null}
  </label>
);
