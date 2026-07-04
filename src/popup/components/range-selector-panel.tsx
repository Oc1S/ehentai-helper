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

  const selectedCount = range[1] - range[0] + 1;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-tight text-ink">{t('downloadRange')}</span>
        <span className="flex h-6 shrink-0 items-center justify-center rounded-full border border-[var(--eh-hairline)] bg-[var(--eh-hover-bg)] px-2 font-mono text-xs font-normal text-ink">
          {range[0]} - {range[1]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <RangeMetric label={t('selected')} value={selectedCount} />
        <RangeMetric label={t('total')} value={maxValue} />
      </div>
      <PageSelector range={range} setRange={setRange} maxValue={maxValue} />
    </>
  );
};

const RangeMetric = ({ label, value }: { label: string; value: number }) => (
  <div className="min-w-0 rounded-eh-sm border border-[var(--eh-hairline-soft)] bg-[var(--eh-hover-bg)] px-2.5 py-2">
    <div className="flex min-w-0 items-baseline gap-1.5">
      <p className="truncate text-base font-semibold leading-none tabular-nums text-ink">{value}</p>
      <span className="shrink-0 text-[10px] font-normal leading-none text-muted-soft">
        {t('imagesLabel')}
      </span>
    </div>
    <p className="mt-1 truncate text-[10px] font-normal leading-none text-muted-soft">{label}</p>
  </div>
);
