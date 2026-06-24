import { Button, type ButtonProps } from '@nextui-org/react';

export type EhButtonAppearance =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'modal-cancel'
  | 'modal-save'
  | 'ghost'
  | 'danger';

const APPEARANCE_CLASS: Partial<Record<EhButtonAppearance, string>> = {
  accent: 'eh-accent-action-btn',
  secondary: 'eh-footer-secondary-btn',
  'modal-cancel': 'settings-modal-btn settings-modal-btn--cancel',
  'modal-save': 'settings-modal-btn settings-modal-btn--save',
};

type EhButtonProps = ButtonProps & {
  appearance?: EhButtonAppearance;
};

export const EhButton = ({
  appearance = 'primary',
  className = '',
  disableRipple,
  color,
  variant,
  ...props
}: EhButtonProps) => {
  if (appearance === 'primary') {
    return (
      <Button
        color={color ?? 'primary'}
        variant={variant}
        className={className}
        disableRipple={disableRipple}
        {...props}
      />
    );
  }

  if (appearance === 'danger') {
    return (
      <Button
        color="danger"
        variant={variant}
        className={className}
        disableRipple={disableRipple}
        {...props}
      />
    );
  }

  if (appearance === 'ghost') {
    return (
      <Button
        variant={variant ?? 'light'}
        className={className}
        disableRipple={disableRipple}
        {...props}
      />
    );
  }

  const appearanceClass = APPEARANCE_CLASS[appearance] ?? '';
  return (
    <Button
      variant="light"
      disableRipple={disableRipple ?? true}
      className={[appearanceClass, className].filter(Boolean).join(' ')}
      {...props}
    />
  );
};
