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
    <div className="eh-pagination" aria-label="Pagination">
      <button
        type="button"
        className="eh-pagination__button"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        aria-label="Previous page"
      >
        <ChevronLeft size={14} strokeWidth={1.8} />
      </button>
      <span className="eh-pagination__label">
        {page} / {safeTotal}
      </span>
      <button
        type="button"
        className="eh-pagination__button"
        disabled={page >= safeTotal}
        onClick={() => onChange(Math.min(safeTotal, page + 1))}
        aria-label="Next page"
      >
        <ChevronRight size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
};
