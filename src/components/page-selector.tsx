import { type FC } from 'react';
import { Minus, Plus } from 'lucide-react';

import { EhButton } from '@/components/eh-button';
import { t } from '@/utils/i18n';

type PageSelectorProps = {
  range: [number, number];
  setRange: (range: [number, number]) => void;
  maxValue: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const PageSelector: FC<PageSelectorProps> = ({ range, setRange, maxValue }) => {
  const startMin = 1;
  const startMax = Math.max(startMin, range[1]);
  const startValue = clamp(range[0], startMin, startMax);
  const isStartLocked = startMin === startMax;

  const setStart = (value: number) => {
    setRange([clamp(value, startMin, startMax), range[1]]);
  };

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
    <div className="flex flex-col gap-3">
      <div className="rounded-eh-sm border border-[var(--eh-hairline)] bg-transparent px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium tracking-tight text-ink">{t('startPosition')}</span>
          <span className="font-mono text-xs font-normal text-muted">{startValue}</span>
        </div>
        <div className="grid grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-2">
          <EhButton
            isIconOnly
            ehSize="sm"
            aria-label={t('decreaseStart')}
            disabled={startValue <= startMin}
            onPress={() => setStart(startValue - 1)}
          >
            <Minus size={13} strokeWidth={1.9} />
          </EhButton>
          <input
            type="range"
            min={startMin}
            max={startMax}
            step={1}
            value={startValue}
            disabled={isStartLocked}
            aria-label={t('dragStartPosition')}
            className="eh-range-slider"
            onChange={(e) => setStart(Number(e.target.value))}
          />
          <EhButton
            isIconOnly
            ehSize="sm"
            aria-label={t('increaseStart')}
            disabled={startValue >= startMax}
            onPress={() => setStart(startValue + 1)}
          >
            <Plus size={13} strokeWidth={1.9} />
          </EhButton>
        </div>
      </div>

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
    </div>
  );
};
