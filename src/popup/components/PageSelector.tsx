import { Input, Slider, type SliderProps } from '@nextui-org/react';
import { type FC } from 'react';

type PageSelectorProps = {
  range: [number, number];
  setRange: (range: [number, number]) => void;
} & SliderProps;

export const PageSelector: FC<PageSelectorProps> = ({ range, maxValue, setRange, ...rest }) => {
  const renderValue = () => (
    <div className="flex shrink-0 items-center gap-1">
      <Input
        type="number"
        min={1}
        value={String(range[0])}
        max={range[1]}
        size="sm"
        className="w-[72px]"
        onChange={(e) => {
          const { value } = e.target;
          range[0] = Number(value);
          setRange([...range]);
        }}
      />
      <span className="caption-soft">–</span>
      <Input
        type="number"
        min={range[0]}
        value={String(range[1])}
        max={maxValue}
        size="sm"
        className="w-[72px]"
        onChange={(e) => {
          const { value } = e.target;
          range[1] = Number(value);
          setRange([...range]);
        }}
      />
    </div>
  );

  return (
    <Slider
      label={<span className="caption shrink-0">Range</span>}
      size="sm"
      value={range}
      step={1}
      minValue={1}
      maxValue={maxValue}
      classNames={{
        base: 'w-full max-w-full gap-3',
        track: 'h-2',
      }}
      renderValue={renderValue}
      onChange={(val) => {
        setRange(val as [number, number]);
      }}
      renderThumb={({ index, ...props }) => (
        <div
          {...props}
          className={`group top-1/2 flex h-5 w-5 cursor-grab items-center justify-center rounded-full border-2 border-canvas bg-ink shadow-pill data-[dragging=true]:cursor-grabbing ${index === 0 ? 'bg-ink' : 'bg-muted'}`}
        >
          <span className="block h-2 w-2 rounded-full bg-canvas" />
        </div>
      )}
      {...rest}
    />
  );
};
