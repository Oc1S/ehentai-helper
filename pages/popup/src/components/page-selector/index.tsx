import { Input, Slider, SliderProps } from '@nextui-org/react';
import { FC } from 'react';

type PageSelectorProps = {
  range: [number, number];
  setRange: (range: [number, number]) => void;
} & SliderProps;

export const PageSelector: FC<PageSelectorProps> = ({ range, maxValue, setRange, ...rest }) => {
  return (
    <Slider
      label={<span className="whitespace-nowrap">Page Range:</span>}
      renderValue={() => {
        return (
          <div className="flex items-center gap-0.5">
            {/* start */}
            <Input
              type="number"
              min={1}
              value={String(range[0])}
              max={range[1]}
              size="sm"
              onChange={e => {
                const { value } = e.target;
                range[0] = Number(value);
                setRange([...range]);
              }}
            />
            -{/* end */}
            <Input
              type="number"
              min={range[0]}
              value={String(range[1])}
              max={maxValue}
              size="sm"
              onChange={e => {
                const { value } = e.target;
                range[1] = Number(value);
                setRange([...range]);
              }}
            />
          </div>
        );
      }}
      minValue={1}
      step={1}
      value={range}
      classNames={{
        base: 'w-60 gap-3',
        filler: ' h-4',
        track: 'border-x-4 h-4',
      }}
      onChange={val => {
        setRange(val as [number, number]);
      }}
      maxValue={maxValue}
      renderThumb={({ ...props }) => (
        <div
          {...props}
          className="border-small border-default-400/50 shadow-medium group top-1/2 cursor-grab rounded-full p-0.5 data-[dragging=true]:cursor-grabbing">
          <span
            className={
              'shadow-small bg-default block h-4 w-4 rounded-full transition-transform group-data-[dragging=true]:scale-95'
            }
          />
        </div>
      )}
      {...rest}
    />
  );
};
