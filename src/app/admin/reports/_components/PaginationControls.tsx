"use client";

type PaginationInfo = {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type Props = {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  disabled?: boolean;
  pageSizeOptions?: number[];
};

export function PaginationControls({
  pagination,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  pageSizeOptions = [20, 50, 100],
}: Props) {
  const startRow = (pagination.page - 1) * pagination.pageSize + 1;
  const endRow = Math.min(pagination.page * pagination.pageSize, pagination.totalRows);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">
          แสดง {startRow} - {endRow} จาก {pagination.totalRows} รายการ
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={!pagination.hasPrevPage || disabled}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ก่อนหน้า
        </button>
        <span className="px-3 text-sm text-slate-600">
          หน้า {pagination.page} จาก {pagination.totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={!pagination.hasNextPage || disabled}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ถัดไป
        </button>
        <select
          className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
          value={pagination.pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={disabled}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} รายการ
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}