import { Slider } from '@nextui-org/react';
import clsx from 'clsx';
import { FC } from 'react';

type PageSelectorProps = {
  range: [number, number];
};

export const PageSelector: FC<PageSelectorProps> = ({ range }) => {
  return (
    <Slider
      size="lg"
      label="Page Range"
      maxValue={range[1]}
      step={1}
      defaultValue={range}
      classNames={{
        base: 'max-w-md gap-3',
        filler: 'bg-gradient-to-r from-pink-300 to-cyan-300 dark:from-pink-600 dark:to-cyan-800',
      }}
      renderThumb={({ index, ...props }) => (
        <div
          {...props}
          className="bg-background border-small border-default-200 dark:border-default-400/50 shadow-medium group top-1/2 cursor-grab rounded-full p-1 data-[dragging=true]:cursor-grabbing">
          <span
            className={clsx(
              'shadow-small group-data-[dragging=true]:scale-80 block h-5 w-5 rounded-full bg-gradient-to-br transition-transform',
              index === 0
                ? 'from-pink-200 to-pink-500 dark:from-pink-400 dark:to-pink-600'
                : 'from-cyan-200 to-cyan-600 dark:from-cyan-600 dark:to-cyan-800'
            )}
          />
        </div>
      )}
    />
  );
};
