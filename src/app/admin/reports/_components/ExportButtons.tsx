"use client";

type Props = {
  onPrint: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
};

export function ExportButtons({
  onPrint,
  onExportCsv,
  onExportExcel,
  disabled = false,
  loading = false,
  error = null,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onPrint}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 px-5 py-2 text-sm font-semibold !text-white shadow-[0_18px_60px_-35px_rgba(37,99,235,1)] transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        พิมพ์ / PDF
      </button>
      <button
        type="button"
        onClick={onExportCsv}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        ดาวน์โหลด CSV
      </button>
      <button
        type="button"
        onClick={onExportExcel}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        ดาวน์โหลด Excel
      </button>
      {loading && (
        <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-600 shadow-inner">
          กำลังโหลดรายงาน...
        </span>
      )}
      {error && (
        <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-4 py-2 text-xs font-medium text-red-600 shadow-inner">
          {error}
        </span>
      )}
    </div>
  );
}