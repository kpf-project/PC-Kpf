"use client";

import { type ChangeEvent } from "react";

type EmployeeOption = {
  id: string;
  name: string;
};

type StoreOption = {
  id: string;
  name: string;
};

type Props = {
  filters: {
    employeeId: string;
    storeId: string;
    month: number;
    year: number;
    day: string;
  };
  employees: EmployeeOption[];
  stores: StoreOption[];
  disabled?: boolean;
  onFilterChange: (key: string, value: string) => void;
  onClearDay: () => void;
};

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

const TIME_ZONE = "Asia/Bangkok";

const currentDate = (() => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month] = formatter.format(new Date()).split("-");
  return {
    month: Number.parseInt(month, 10),
    year: Number.parseInt(year, 10),
  };
})();

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function ReportFilters({
  filters,
  employees,
  stores,
  disabled = false,
  onFilterChange,
  onClearDay,
}: Props) {
  const dayOptions = Array.from(
    { length: getDaysInMonth(filters.year, filters.month) },
    (_, index) => index + 1
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600">พนักงาน *</label>
        <select
          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
          value={filters.employeeId}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onFilterChange("employeeId", event.target.value)
          }
          disabled={disabled}
        >
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600">ร้านค้า / หน่วยงาน</label>
        <select
          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
          value={filters.storeId}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onFilterChange("storeId", event.target.value)
          }
          disabled={disabled}
        >
          <option value="">ทั้งหมด</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600">เดือน</label>
        <select
          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
          value={filters.month}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onFilterChange("month", event.target.value)
          }
          disabled={disabled}
        >
          {THAI_MONTHS.map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600">ปี (ค.ศ.)</label>
        <select
          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
          value={filters.year}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onFilterChange("year", event.target.value)
          }
          disabled={disabled}
        >
          {Array.from({ length: 5 }, (_, index) => currentDate.year - 2 + index).map(
            (yearOption) => (
              <option key={yearOption} value={yearOption}>
                {yearOption} (พ.ศ. {yearOption + 543})
              </option>
            )
          )}
        </select>
      </div>

      <div className="space-y-2 md:col-span-2 lg:col-span-1">
        <label className="text-xs font-semibold text-slate-600">วันที่</label>
        <div className="flex gap-2">
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
            value={filters.day}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onFilterChange("day", event.target.value)
            }
            disabled={disabled}
          >
            <option value="">ทั้งเดือน</option>
            {dayOptions.map((dayOption) => (
              <option key={dayOption} value={String(dayOption)}>
                {dayOption}
              </option>
            ))}
          </select>
          {filters.day && (
            <button
              type="button"
              onClick={onClearDay}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800"
              disabled={disabled}
            >
              ล้าง
            </button>
          )}
        </div>
      </div>
    </div>
  );
}