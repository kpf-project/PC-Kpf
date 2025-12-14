"use client";

import { ChangeEvent, FormEvent } from "react";

type EmployeeOption = {
  id: string;
  name: string;
};

type StoreOption = {
  id: string;
  name: string;
};

type FilterState = {
  date: string | null;
  dateEnd: string | null;
  employeeId: string | null;
  storeId: string | null;
  status: "all" | "draft" | "submitted";
  page: number;
  limit: number;
};

type Props = {
  filters: FilterState;
  employeeOptions: EmployeeOption[];
  storeOptions: StoreOption[];
  onFilterChange: (filters: Partial<FilterState>) => void;
  onClear: () => void;
  onExportAll: () => void;
  isExporting: boolean;
  disabled?: boolean;
};

export function ReportFilters({
  filters,
  employeeOptions,
  storeOptions,
  onFilterChange,
  onClear,
  onExportAll,
  isExporting,
  disabled = false,
}: Props) {
  const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ date: e.target.value || null });
  };

  const handleDateEndChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ dateEnd: e.target.value || null });
  };

  const handleEmployeeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ employeeId: e.target.value || null });
  };

  const handleStoreChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ storeId: e.target.value || null });
  };

  const handleStatusChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ status: e.target.value as "all" | "draft" | "submitted" });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Filters are already applied via onChange
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* First row: Date range */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-slate-700">
              วันที่เริ่มต้น
            </label>
            <input
              type="date"
              id="date"
              value={filters.date || ""}
              onChange={handleDateChange}
              disabled={disabled}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label htmlFor="dateEnd" className="block text-sm font-medium text-slate-700">
              วันที่สิ้นสุด (ถ้ามี)
            </label>
            <input
              type="date"
              id="dateEnd"
              value={filters.dateEnd || ""}
              onChange={handleDateEndChange}
              disabled={disabled}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </div>

        {/* Second row: Employee, Store, Status */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <label htmlFor="employee" className="block text-sm font-medium text-slate-700">
              พนักงาน
            </label>
            <select
              id="employee"
              value={filters.employeeId || ""}
              onChange={handleEmployeeChange}
              disabled={disabled}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">ทั้งหมด</option>
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="store" className="block text-sm font-medium text-slate-700">
              ร้าน
            </label>
            <select
              id="store"
              value={filters.storeId || ""}
              onChange={handleStoreChange}
              disabled={disabled}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">ทั้งหมด</option>
              {storeOptions.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-slate-700">
              สถานะ
            </label>
            <select
              id="status"
              value={filters.status}
              onChange={handleStatusChange}
              disabled={disabled}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="all">ทั้งหมด</option>
              <option value="draft">แบบร่าง</option>
              <option value="submitted">ส่งแล้ว</option>
            </select>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ล้างฟิลเตอร์
          </button>

          <button
            type="button"
            onClick={onExportAll}
            disabled={disabled || isExporting}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                กำลังสร้าง PDF...
              </>
            ) : (
              <>
                📄 Export ทั้งหมด (PDF)
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
