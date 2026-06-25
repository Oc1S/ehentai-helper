import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

export type EhButtonAppearance =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'link'
  | 'icon';

export type EhButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<EhButtonSize, string> = {
  xs: 'eh-btn--xs',
  sm: 'eh-btn--sm',
  md: 'eh-btn--md',
  lg: 'eh-btn--lg',
};

const APPEARANCE_CLASS: Record<EhButtonAppearance, string> = {
  primary: 'eh-btn--primary',
  accent: 'eh-btn--accent',
  secondary: 'eh-btn--secondary',
  danger: 'eh-btn--danger',
  ghost: 'eh-btn--ghost',
  link: 'eh-btn--link',
  icon: 'eh-btn--icon',
};

type EhButtonProps = {
  appearance?: EhButtonAppearance;
  ehSize?: EhButtonSize;
  fullWidth?: boolean;
  onPress?: () => void;
  isDisabled?: boolean;
  isIconOnly?: boolean;
  startContent?: ReactNode;
  endContent?: ReactNode;
  as?: 'button' | 'a';
  href?: string;
  target?: string;
  rel?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>;

export const EhButton = ({
  appearance = 'primary',
  ehSize = 'md',
  fullWidth = false,
  className = '',
  onPress,
  onClick,
  isDisabled,
  disabled,
  startContent,
  endContent,
  children,
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
    APPEARANCE_CLASS[appearance],
    fullWidth ? 'eh-btn--full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const isDisabledState = Boolean(disabled ?? isDisabled);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    if (isDisabledState) {
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
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a
        className={classes}
        href={isDisabledState ? undefined : href}
        target={target}
        rel={rel}
        aria-disabled={isDisabledState}
        onClick={handleClick}
        {...anchorProps}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={isDisabledState}
      onClick={handleClick}
      {...rest}
    >
      {content}
    </button>
  );
};
