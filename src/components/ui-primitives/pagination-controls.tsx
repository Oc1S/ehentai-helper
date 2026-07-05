import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PaginationControls = ({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) => {
  const safeTotal = Math.max(1, total);

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-[var(--eh-hairline)] bg-transparent p-1"
      aria-label="Pagination"
    >
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--eh-hover-bg)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        aria-label="Previous page"
      >
        <ChevronLeft size={14} strokeWidth={1.8} />
      </button>
      <span className="min-w-12 px-1 text-center font-mono text-xs text-muted">
        {page} / {safeTotal}
      </span>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--eh-hover-bg)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted"
        disabled={page >= safeTotal}
        onClick={() => onChange(Math.min(safeTotal, page + 1))}
        aria-label="Next page"
      >
        <ChevronRight size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
};
