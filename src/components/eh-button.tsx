import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { type HTMLMotionProps, motion } from 'framer-motion';

export type EhButtonVariant = 'primary' | 'secondary' | 'danger' | 'link';

export type EhButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<EhButtonSize, string> = {
  xs: 'eh-btn--xs',
  sm: 'eh-btn--sm',
  md: 'eh-btn--md',
  lg: 'eh-btn--lg',
};

const VARIANT_CLASS: Record<EhButtonVariant, string> = {
  primary: 'eh-btn--primary',
  secondary: 'eh-btn--secondary',
  danger: 'eh-btn--danger',
  link: 'eh-btn--link',
};

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
  const classes = [
    'eh-btn',
    SIZE_CLASS[ehSize],
    isIconOnly ? 'eh-btn--icon' : VARIANT_CLASS[variant],
    fullWidth ? 'eh-btn--full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

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

  if (as === 'a' && href) {
    const anchorProps = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a
        className={classes}
        href={isDisabled ? undefined : href}
        target={target}
        rel={rel}
        aria-disabled={isDisabled}
        {...anchorProps}
        onClick={handleClick}
      >
        {content}
      </a>
    );
  }

  return (
    <motion.button
      type={type}
      className={classes}
      disabled={isDisabled}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      {...rest}
      onClick={handleClick}
    >
      {content}
    </motion.button>
  );
};
