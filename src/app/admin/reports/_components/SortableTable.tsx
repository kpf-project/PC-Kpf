"use client";

import { useTableSort, type SortDirection } from "@/hooks/useTableSort";

export type ColumnDef<T> = {
  key: keyof T;
  header: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  className?: string;
};

type Props<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  className?: string;
  onSort?: (key: keyof T, direction: SortDirection) => void;
  rowKey?: (row: T, index: number) => React.Key;
};

export function SortableTable<T extends Record<string, unknown>>({
  columns,
  data,
  className = "",
  onSort,
  rowKey,
}: Props<T>) {
  const { sortedData, sortConfig, handleSort, getSortIcon } = useTableSort(data);

  const handleColumnClick = (column: ColumnDef<T>) => {
    if (column.sortable !== false) {
      handleSort(column.key);
      if (onSort) {
        // Get the new direction after sort
        let newDirection: SortDirection = "asc";
        if (sortConfig.key === column.key) {
          if (sortConfig.direction === "asc") {
            newDirection = "desc";
          } else if (sortConfig.direction === "desc") {
            newDirection = null;
          }
        }
        onSort(column.key, newDirection);
      }
    }
  };

  const getAlignClass = (align?: "left" | "center" | "right") => {
    switch (align) {
      case "left":
        return "text-left";
      case "right":
        return "text-right";
      default:
        return "text-center";
    }
  };

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 ${className}`}>
      <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
        <table className="min-w-full border-collapse" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr className="bg-slate-100 text-[13px] font-semibold text-slate-700">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`border border-slate-200 px-3 py-2 whitespace-nowrap ${getAlignClass(column.align)} ${
                    column.sortable !== false ? "cursor-pointer hover:bg-slate-200 transition-colors select-none" : ""
                  } ${column.className || ""}`}
                  onClick={() => handleColumnClick(column)}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{column.header}</span>
                    {column.sortable !== false && (
                      <span className="text-slate-400 text-xs">
                        {getSortIcon(column.key)}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => (
              <tr key={rowKey ? rowKey(row, index) : index} className="text-[13px] text-slate-700">
                {columns.map((column) => {
                  const value = row[column.key];
                  const content = column.render
                    ? column.render(value, row)
                    : String(value ?? "");

                  return (
                    <td
                      key={String(column.key)}
                      className={`border border-slate-200 px-3 py-2 whitespace-nowrap ${getAlignClass(
                        column.align
                      )} leading-snug ${column.className || ""}`}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
