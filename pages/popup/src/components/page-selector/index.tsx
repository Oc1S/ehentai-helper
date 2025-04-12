import { Input, Slider, SliderProps } from '@nextui-org/react';
import { FC } from 'react';

type PageSelectorProps = {
  range: [number, number];
  setRange: (range: [number, number]) => void;
} & SliderProps;

export const PageSelector: FC<PageSelectorProps> = ({ range, maxValue, setRange, ...rest }) => {
  const renderValue = () => {
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
  };
  return (
    <Slider
      label={<span className="whitespace-nowrap pr-2">Page Range:</span>}
      size="sm"
      value={range}
      step={1}
      minValue={1}
      maxValue={maxValue}
      classNames={{
        base: 'w-60 gap-3',
        filler: 'bg-gradient-to-r from-slate-700 to-slate-500',
        track: 'h-6',
      }}
      renderValue={renderValue}
      onChange={val => {
        setRange(val as [number, number]);
      }}
      renderThumb={({ index, ...props }) => (
        <div
          {...props}
          className={`shadow-medium group top-1/2 flex h-6 w-6 cursor-grab items-center justify-center rounded-full data-[dragging=true]:cursor-grabbing ${index === 0 ? 'bg-slate-700' : 'bg-slate-500'}`}>
          <span
            className={
              'shadow-small block h-3/4 w-3/4 rounded-full bg-white/80 transition-transform group-data-[dragging=true]:scale-95'
            }
          />
        </div>
      )}
      {...rest}
    />
  );
};
