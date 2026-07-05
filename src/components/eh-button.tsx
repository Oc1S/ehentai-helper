import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { type HTMLMotionProps, motion } from 'framer-motion';

export type EhButtonVariant = 'primary' | 'secondary' | 'danger' | 'link';

export type EhButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const buttonClass = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap border bg-none font-medium transition-colors [border-radius:var(--eh-btn-radius,6px)] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
  {
    variants: {
      size: {
        xs: 'h-7 min-h-7 px-2 text-xs font-normal',
        sm: 'h-9 min-h-9 min-w-14 px-3.5 text-[13px] font-normal',
        md: 'h-10 min-h-10 px-4 text-[13px]',
        lg: 'h-12 min-h-12 gap-2.5 px-5 text-sm [--eh-btn-radius:var(--eh-btn-radius-lg,8px)]',
      },
      variant: {
        primary:
          'border-brand-primary bg-brand-primary text-primary-foreground shadow-none hover:border-brand-primary-active hover:bg-brand-primary-active',
        secondary:
          'border-hairline bg-transparent text-ink shadow-none hover:border-hairline hover:bg-[var(--eh-hover-bg)]',
        danger:
          'border-error/30 bg-error/[0.06] text-error hover:border-error/45 hover:bg-error/10',
        link: 'h-auto min-h-0 min-w-0 border-0 bg-transparent p-0 font-normal text-[rgb(var(--eh-action-blue))] underline-offset-2 hover:underline',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'primary',
    },
  }
);

const iconButtonClass = cva(
  'inline-flex aspect-square shrink-0 cursor-pointer items-center justify-center rounded-full border border-hairline bg-transparent p-0 leading-none text-muted transition-colors hover:border-hairline hover:bg-[var(--eh-hover-bg)] hover:text-body disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&>svg]:shrink-0',
  {
    variants: {
      size: {
        xs: 'h-7 min-h-7 w-7 min-w-7',
        sm: 'h-8 min-h-8 w-8 min-w-8',
        md: 'h-9 min-h-9 w-9 min-w-9',
        lg: 'h-10 min-h-10 w-10 min-w-10',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

type EhButtonProps = {
  variant?: EhButtonVariant;
  ehSize?: EhButtonSize;
  fullWidth?: boolean;
  isIconOnly?: boolean;
  startContent?: ReactNode;
  endContent?: ReactNode;
  children?: ReactNode;
  as?: 'button' | 'a';
  href?: string;
  target?: string;
  rel?: string;
  onPress?: () => void;
} & Omit<HTMLMotionProps<'button'>, 'color' | 'children' | 'ref'>;

export const EhButton = ({
  variant = 'primary',
  ehSize = 'md',
  fullWidth = false,
  className = '',
  onPress,
  onClick,
  disabled,
  startContent,
  endContent,
  children,
  isIconOnly,
  as,
  href,
  target,
  rel,
  type = 'button',
  ...rest
}: EhButtonProps) => {
  const classes = isIconOnly
    ? iconButtonClass({ size: ehSize, className })
    : buttonClass({
        size: ehSize,
        variant,
        fullWidth,
        className,
      });

  const isDisabled = Boolean(disabled);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    onPress?.();
    onClick?.(event as React.MouseEvent<HTMLButtonElement>);
  };

  const content = (
    <>
      {startContent}
      {children}
      {endContent}
    </>
  );

  const tapMotion = {
    whileTap: isDisabled ? undefined : { scale: 0.95 as const },
    transition: { type: 'spring' as const, visualDuration: 0.25, bounce: 0.3 },
  };

  if (as === 'a' && href) {
    return (
      <motion.a
        className={classes}
        href={isDisabled ? undefined : href}
        target={target}
        rel={rel}
        aria-disabled={isDisabled}
        {...tapMotion}
        onClick={handleClick}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.button
      type={type}
      className={classes}
      disabled={isDisabled}
      {...tapMotion}
      {...rest}
      onClick={handleClick}
    >
      {content}
    </motion.button>
  );
};
