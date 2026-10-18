import type { Pagination as PaginationInfo } from '@/lib/types';

export function Pagination({ info, onPage }: { info: PaginationInfo; onPage: (page: number) => void }) {
  if (info.totalPages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      <button className="btn btn--quiet btn--small" disabled={info.page <= 1} onClick={() => onPage(info.page - 1)}>
        Previous
      </button>
      <span className="muted">
        Page {info.page} of {info.totalPages}
      </span>
      <button className="btn btn--quiet btn--small" disabled={info.page >= info.totalPages} onClick={() => onPage(info.page + 1)}>
        Next
      </button>
    </nav>
  );
}