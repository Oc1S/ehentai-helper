import { Button as NextUIButton, ButtonProps } from '@nextui-org/react';

export const Button = (props: ButtonProps) => {
  return <NextUIButton color="primary" variant="flat" {...props} />;
};
