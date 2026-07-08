import {
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
  // 输入框本地草稿：允许清空/部分输入，仅在 blur 或回车时 commit 校验
  const [fromDraft, setFromDraft] = useState(String(range[0]));
  const [toDraft, setToDraft] = useState(String(range[1]));
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

  // 外部 range 变化（如拖动滑块）时同步草稿
  useEffect(() => {
    setFromDraft(String(range[0]));
  }, [range[0]]);
  useEffect(() => {
    setToDraft(String(range[1]));
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

  const commitFrom = (raw: string) => {
    const next = Number.parseInt(raw, 10);
    // 清空或非法：回退到当前值，不强制改成 1（允许用户中途清空重新输入）
    if (Number.isNaN(next)) {
      setFromDraft(String(range[0]));
      return;
    }
    const clamped = clamp(next, 1, range[1]);
    setRange([clamped, range[1]]);
    setFromDraft(String(clamped));
  };

  const commitTo = (raw: string) => {
    const next = Number.parseInt(raw, 10);
    // 清空或非法：回退到当前值，不强制改成 maxValue（允许用户中途清空重新输入）
    if (Number.isNaN(next)) {
      setToDraft(String(range[1]));
      return;
    }
    const clamped = clamp(next, range[0], maxValue);
    setRange([range[0], clamped]);
    setToDraft(String(clamped));
  };

  const handleFromKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
  };

  const handleToKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
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
            type="number"
            inputMode="numeric"
            min={1}
            max={range[1]}
            value={fromDraft}
            aria-label={t('rangeFrom')}
            className="eh-number-input flex-1 rounded-eh-sm border border-[var(--eh-hairline)] bg-transparent px-2.5 py-2 font-mono text-[13px] tabular-nums text-ink outline-none transition-colors placeholder:text-muted-soft focus:border-[rgb(var(--eh-brand-primary-active))]"
            onChange={(e) => setFromDraft(sanitizeRangeText(e.target.value))}
            onBlur={(e) => commitFrom(e.target.value)}
            onKeyDown={handleFromKeyDown}
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
            value={toDraft}
            aria-label={t('rangeTo')}
            className="eh-number-input flex-1 rounded-eh-sm border border-[var(--eh-hairline)] bg-transparent px-2.5 py-2 font-mono text-[13px] tabular-nums text-ink outline-none transition-colors placeholder:text-muted-soft focus:border-[rgb(var(--eh-brand-primary-active))]"
            onChange={(e) => setToDraft(sanitizeRangeText(e.target.value))}
            onBlur={(e) => commitTo(e.target.value)}
            onKeyDown={handleToKeyDown}
          />
        </label>
      </div>
    </div>
  );
};
