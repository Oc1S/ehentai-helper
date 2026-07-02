import { type FC } from 'react';

import { t } from '@/utils/i18n';

type PageSelectorProps = {
  range: [number, number];
  setRange: (range: [number, number]) => void;
  maxValue: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const PageSelector: FC<PageSelectorProps> = ({ range, setRange, maxValue }) => {
  const commitFrom = (raw: string) => {
    const next = Number.parseInt(raw, 10);
    if (Number.isNaN(next)) {
      setRange([1, range[1]]);
      return;
    }
    setRange([clamp(next, 1, range[1]), range[1]]);
  };

  const commitTo = (raw: string) => {
    const next = Number.parseInt(raw, 10);
    if (Number.isNaN(next)) {
      setRange([range[0], maxValue]);
      return;
    }
    setRange([range[0], clamp(next, range[0], maxValue)]);
  };

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-normal uppercase tracking-wide text-muted-soft">
          {t('rangeFrom')}
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={range[1]}
          value={range[0]}
          aria-label={t('rangeFrom')}
          className="eh-number-input"
          onChange={(e) => commitFrom(e.target.value)}
          onBlur={(e) => commitFrom(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-normal uppercase tracking-wide text-muted-soft">
          {t('rangeTo')}
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={range[0]}
          max={maxValue}
          value={range[1]}
          aria-label={t('rangeTo')}
          className="eh-number-input"
          onChange={(e) => commitTo(e.target.value)}
          onBlur={(e) => commitTo(e.target.value)}
        />
      </label>
    </div>
  );
};
