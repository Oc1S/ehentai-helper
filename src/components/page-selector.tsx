import {
  type ChangeEvent,
  type CSSProperties,
  type FC,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { t } from '@/utils/i18n';

type PageSelectorProps = {
  range: [number, number];
  setRange: (range: [number, number]) => void;
  maxValue: number;
};

type RangeThumb = 'start' | 'end';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const sanitizeRangeText = (raw: string) => raw.replace(/[^0-9]/g, '');

export const PageSelector: FC<PageSelectorProps> = ({ range, setRange, maxValue }) => {
  const [activeThumb, setActiveThumb] = useState<RangeThumb | null>(null);
  const fromInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const startThumbRef = useRef<HTMLButtonElement>(null);
  const endThumbRef = useRef<HTMLButtonElement>(null);
  const minValue = 1;
  const safeMaxValue = Math.max(minValue, maxValue);
  const safeEnd = clamp(range[1], minValue, safeMaxValue);
  const safeStart = clamp(range[0], minValue, safeEnd);
  const rangeSpan = safeMaxValue - minValue;
  const startPercent = rangeSpan <= 0 ? 0 : ((safeStart - minValue) / rangeSpan) * 100;
  const endPercent = rangeSpan <= 0 ? 0 : ((safeEnd - minValue) / rangeSpan) * 100;
  const fillStyle: CSSProperties = {
    left: `${startPercent}%`,
    right: `${100 - endPercent}%`,
  };
  const startThumbStyle: CSSProperties = { left: `${startPercent}%` };
  const endThumbStyle: CSSProperties = { left: `${endPercent}%` };

  // 输入框非受控：仅在未聚焦时把外部 range 变化（如拖动滑块）同步回输入框，
  // 避免在用户编辑过程中覆盖其输入。
  useEffect(() => {
    if (document.activeElement === fromInputRef.current) return;
    if (fromInputRef.current) fromInputRef.current.value = String(range[0]);
  }, [range[0]]);
  useEffect(() => {
    if (document.activeElement === toInputRef.current) return;
    if (toInputRef.current) toInputRef.current.value = String(range[1]);
  }, [range[1]]);

  const valueFromPointer = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return minValue;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      return clamp(Math.round(minValue + ratio * rangeSpan), minValue, safeMaxValue);
    },
    [rangeSpan, safeMaxValue],
  );

  const updateThumb = useCallback(
    (thumb: RangeThumb, value: number) => {
      if (thumb === 'start') {
        setRange([clamp(value, minValue, safeEnd), safeEnd]);
        return;
      }
      setRange([safeStart, clamp(value, safeStart, safeMaxValue)]);
    },
    [safeEnd, safeMaxValue, safeStart, setRange],
  );

  const pickNearestThumb = useCallback(
    (value: number): RangeThumb => {
      if (value <= safeStart) return 'start';
      if (value >= safeEnd) return 'end';
      return value - safeStart <= safeEnd - value ? 'start' : 'end';
    },
    [safeEnd, safeStart],
  );

  // 非受控：合法数字即提交。start > end 时抬高 end；end < start 时压低 start。
  // blur 时若仍不合理，回退到当前 range 值。
  const tryCommitFrom = (raw: string) => {
    const next = Number.parseInt(raw, 10);
    if (Number.isNaN(next) || next < minValue || next > safeMaxValue) return false;
    setRange(next > range[1] ? [next, next] : [next, range[1]]);
    return true;
  };

  const tryCommitTo = (raw: string) => {
    const next = Number.parseInt(raw, 10);
    if (Number.isNaN(next) || next < minValue || next > safeMaxValue) return false;
    setRange(next < range[0] ? [next, next] : [range[0], next]);
    return true;
  };

  const handleFromChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeRangeText(e.target.value);
    e.target.value = raw;
    tryCommitFrom(raw);
  };

  const handleToChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeRangeText(e.target.value);
    e.target.value = raw;
    tryCommitTo(raw);
  };

  const handleFromBlur = () => {
    if (fromInputRef.current) fromInputRef.current.value = String(range[0]);
  };

  const handleToBlur = () => {
    if (toInputRef.current) toInputRef.current.value = String(range[1]);
  };

  const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
  };

  const focusThumb = (thumb: RangeThumb) => {
    const thumbRef = thumb === 'start' ? startThumbRef : endThumbRef;
    thumbRef.current?.focus();
  };

  const handleRangePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (safeMaxValue <= minValue) return;
    const target = event.target as HTMLElement;
    const thumbElement = target.closest('[data-range-thumb]') as HTMLElement | null;
    const value = valueFromPointer(event.clientX);
    const thumb = (thumbElement?.dataset.rangeThumb as RangeThumb | undefined) ?? pickNearestThumb(value);

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveThumb(thumb);
    focusThumb(thumb);
    updateThumb(thumb, value);
  };

  const handleRangePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!activeThumb) return;
    event.preventDefault();
    updateThumb(activeThumb, valueFromPointer(event.clientX));
  };

  const handleRangePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setActiveThumb(null);
  };

  const handleThumbKeyDown =
    (thumb: RangeThumb) => (event: KeyboardEvent<HTMLButtonElement>) => {
      const currentValue = thumb === 'start' ? safeStart : safeEnd;
      let nextValue = currentValue;

      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') nextValue -= 1;
      else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') nextValue += 1;
      else if (event.key === 'PageDown') nextValue -= 10;
      else if (event.key === 'PageUp') nextValue += 10;
      else if (event.key === 'Home') nextValue = thumb === 'start' ? minValue : safeStart;
      else if (event.key === 'End') nextValue = thumb === 'start' ? safeEnd : safeMaxValue;
      else return;

      event.preventDefault();
      updateThumb(thumb, nextValue);
    };

  return (
    <div className="flex flex-col gap-3">
      <div className="px-1 py-1">
        <div
          ref={trackRef}
          className="eh-dual-range relative h-8 touch-none select-none"
          onPointerDown={handleRangePointerDown}
          onPointerMove={handleRangePointerMove}
          onPointerUp={handleRangePointerEnd}
          onPointerCancel={handleRangePointerEnd}
          onLostPointerCapture={() => setActiveThumb(null)}
        >
          <div className="eh-dual-range__track absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" />
          <div
            className="eh-dual-range__fill absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
            style={fillStyle}
          />
          <button
            ref={startThumbRef}
            type="button"
            role="slider"
            aria-label={t('startPosition')}
            aria-valuemin={minValue}
            aria-valuemax={safeEnd}
            aria-valuenow={safeStart}
            data-range-thumb="start"
            className={[
              'eh-dual-range__thumb absolute top-1/2 h-4 w-4 cursor-grab rounded-full p-0 active:cursor-grabbing',
              activeThumb === 'start' ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={startThumbStyle}
            onKeyDown={handleThumbKeyDown('start')}
          />
          <button
            ref={endThumbRef}
            type="button"
            role="slider"
            aria-label={t('endPosition')}
            aria-valuemin={safeStart}
            aria-valuemax={safeMaxValue}
            aria-valuenow={safeEnd}
            data-range-thumb="end"
            className={[
              'eh-dual-range__thumb absolute top-1/2 h-4 w-4 cursor-grab rounded-full p-0 active:cursor-grabbing',
              activeThumb === 'end' ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={endThumbStyle}
            onKeyDown={handleThumbKeyDown('end')}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-normal uppercase tracking-wide text-muted-soft">
            {t('rangeFrom')}
          </span>
          <input
            ref={fromInputRef}
            type="number"
            inputMode="numeric"
            min={minValue}
            max={safeMaxValue}
            defaultValue={range[0]}
            aria-label={t('rangeFrom')}
            className="eh-number-input flex-1 rounded-eh-sm border border-[var(--eh-hairline)] bg-transparent px-2.5 py-2 font-mono text-[13px] tabular-nums text-ink outline-none transition-colors placeholder:text-muted-soft focus:border-[rgb(var(--eh-brand-primary-active))]"
            onChange={handleFromChange}
            onBlur={handleFromBlur}
            onKeyDown={blurOnEnter}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-normal uppercase tracking-wide text-muted-soft">
            {t('rangeTo')}
          </span>
          <input
            ref={toInputRef}
            type="number"
            inputMode="numeric"
            min={minValue}
            max={safeMaxValue}
            defaultValue={range[1]}
            aria-label={t('rangeTo')}
            className="eh-number-input flex-1 rounded-eh-sm border border-[var(--eh-hairline)] bg-transparent px-2.5 py-2 font-mono text-[13px] tabular-nums text-ink outline-none transition-colors placeholder:text-muted-soft focus:border-[rgb(var(--eh-brand-primary-active))]"
            onChange={handleToChange}
            onBlur={handleToBlur}
            onKeyDown={blurOnEnter}
          />
        </label>
      </div>
    </div>
  );
};
