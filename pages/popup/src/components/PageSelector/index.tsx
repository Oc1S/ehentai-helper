import { Slider, SliderProps } from '@nextui-org/react';
import clsx from 'clsx';
import { FC } from 'react';

type PageSelectorProps = {
  range: [number, number];
} & SliderProps;

export const PageSelector: FC<PageSelectorProps> = ({ range, ...rest }) => {
  return (
    <Slider
      label="Page Range"
      minValue={1}
      step={1}
      defaultValue={range}
      classNames={{
        base: 'w-60 gap-3',
        filler: 'bg-gradient-to-r from-secondary to-primary h-4',
        track: 'border-x-4 h-4',
      }}
      renderThumb={({ index, ...props }) => (
        <div
          {...props}
          className="bg-background border-small border-default-400/50 shadow-medium group top-1/2 cursor-grab rounded-full p-0.5 data-[dragging=true]:cursor-grabbing">
          <span
            className={clsx(
              'shadow-small bg-primary block h-4 w-4 rounded-full transition-transform group-data-[dragging=true]:scale-95',
              index === 0 && 'bg-secondary'
            )}
          />
        </div>
      )}
      {...rest}
    />
  );
};
