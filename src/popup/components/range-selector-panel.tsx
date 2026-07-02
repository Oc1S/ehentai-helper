import { PageSelector } from '@/components/page-selector';
import { t } from '@/utils/i18n';

export const RangeSelectorContent = ({
  range,
  setRange,
  maxValue,
}: {
  range: [number, number];
  setRange: (range: [number, number]) => void;
  maxValue: number;
}) => {
  if (range[1] <= 0) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-tight text-ink">{t('downloadRange')}</span>
        <span className="flex h-6 shrink-0 items-center justify-center rounded-full border border-[var(--eh-hairline)] bg-[rgba(23,23,28,0.045)] px-2 font-mono text-xs font-normal text-ink">
          {range[0]} - {range[1]}
        </span>
      </div>
      <PageSelector range={range} setRange={setRange} maxValue={maxValue} />
    </>
  );
};

export const RangeSelectorPanel = ({
  range,
  setRange,
  maxValue,
}: {
  range: [number, number];
  setRange: (range: [number, number]) => void;
  maxValue: number;
}) => {
  if (range[1] <= 0) return null;

  return (
    <div className="glass-panel rounded-eh-xl flex flex-col gap-2.5 px-4 py-3.5">
      <RangeSelectorContent range={range} setRange={setRange} maxValue={maxValue} />
    </div>
  );
};
