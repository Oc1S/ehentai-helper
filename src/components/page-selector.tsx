import { type FC } from 'react';
import { Input, Slider, type SliderProps } from '@nextui-org/react';

type PageSelectorProps = {
  range: [number, number];
  setRange: (range: [number, number]) => void;
} & SliderProps;

export const PageSelector: FC<PageSelectorProps> = ({ range, maxValue, setRange, ...rest }) => (
  <div className="flex flex-col gap-4">
    <Slider
      aria-label="Image range"
      size="sm"
      value={range}
      step={1}
      minValue={1}
      maxValue={maxValue}
      classNames={{
        base: 'w-full max-w-full gap-2',
        track: 'h-2 border-s border-hairline-soft bg-surface-strong',
        filler: 'bg-brand-accent',
      }}
      onChange={(val) => {
        setRange(val as [number, number]);
      }}
      renderThumb={({ index, ...props }) => (
        <div
          {...props}
          className="group top-1/2 flex h-5 w-5 cursor-grab items-center justify-center rounded-full border border-surface-strong bg-surface-card shadow-card outline-none transition-[transform,border-color,box-shadow] duration-200 hover:scale-110 hover:border-brand-accent data-[dragging=true]:scale-110 data-[dragging=true]:cursor-grabbing data-[dragging=true]:border-brand-accent data-[dragging=true]:shadow-card-elevated"
        >
          <div
            className={`h-1.5 w-1.5 rounded-full transition-all duration-300 group-hover:scale-[1.5] group-hover:bg-brand-accent group-data-[dragging=true]:scale-[1.5] group-data-[dragging=true]:bg-brand-accent ${
              index === 0 ? 'bg-muted-soft' : 'bg-brand-accent'
            }`}
          />
        </div>
      )}
      {...rest}
    />
    <div className="grid grid-cols-2 gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">
          From
        </span>
        <Input
          type="number"
          min={1}
          value={String(range[0])}
          max={range[1]}
          size="sm"
          classNames={{
            inputWrapper: 'border border-surface-strong bg-surface-soft shadow-none',
          }}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isNaN(next)) return;
            setRange([Math.min(next, range[1]), range[1]]);
          }}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">To</span>
        <Input
          type="number"
          min={range[0]}
          value={String(range[1])}
          max={maxValue}
          size="sm"
          classNames={{
            inputWrapper: 'border border-surface-strong bg-surface-soft shadow-none',
          }}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isNaN(next)) return;
            setRange([range[0], Math.max(next, range[0])]);
          }}
        />
      </label>
    </div>
  </div>
);
