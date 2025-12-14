"use client";

import React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { getBrandingLogoSrc, getBrandingLogoUrl } from "@/lib/branding";

type EmployeeOption = {
  id: string;
  name: string;
  phone: string | null;
  province: string | null;
  region: string | null;
  defaultStoreId: string | null;
};

type StoreOption = {
  id: string;
  name: string;
  province: string | null;
};

type SessionData = {
  storeName: string | null;
  storeProvince: string | null;
  checkInTime: string;
  checkOutTime: string;
  workingHours: string;
};

type ReportRow = {
  dateIso: string;
  day: number;
  dayLabel: string;
  dayOfWeek: string;
  status: "present" | "leave" | "day-off" | "absent" | "future";
  leaveType: string | null;
  // Multi-session support
  sessions: SessionData[];
  storeCount: number;
  firstCheckInTime: string;
  lastCheckOutTime: string;
  totalWorkingHours: string;
  // Legacy fields (for backward compatibility with single session)
  storeName: string | null;
  storeProvince: string | null;
  checkInTime: string;
  checkOutTime: string;
  workingHours: string;
};

type PaginationInfo = {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type MonthInfo = {
  monthKey: string;
  monthLabel: string;
  year: number;
  month: number;
  rowCount?: number;
};

type ReportData = {
  employee: EmployeeOption;
  store: StoreOption | null;
  branding: {
    logoPath: string | null;
    updatedAt: string;
  };
  filters: {
    storeId: string | null;
    rangeSummary: string;
    ranges: Array<{
      startIso: string;
      endIso: string;
      label: string;
    }>;
  };
  rows: ReportRow[];
  currentMonth: MonthInfo | null;
  allMonths: MonthInfo[];
  pagination?: PaginationInfo;
};

type Props = {
  initialEmployees: EmployeeOption[];
};

const FALLBACK_LOGO = "/icons/icon-192x192.png";

const DAILY_ALLOWANCE_RATE = 150;

const THAI_INTEGER_FORMATTER = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 0,
});

const SIGNATURE_LINE_BLANK_CLASS =
  "mx-2 inline-flex min-w-[150px] justify-center border-b border-slate-400 pb-1 whitespace-nowrap";
const SIGNATURE_SPACER_LINE_CLASS =
  "mx-2 inline-flex min-w-[70px] border-b border-slate-400 whitespace-nowrap";
const SIGNATURE_LABEL_CLASS = "inline-flex w-20 justify-start whitespace-nowrap";

type RangeItem = {
  id: string;
  start: string;
  end: string;
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getUTCDay();
  const diff = (day + 6) % 7; // Monday start
  result.setUTCDate(result.getUTCDate() - diff);
  return new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth(), result.getUTCDate()));
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  start.setUTCDate(start.getUTCDate() + 6);
  return start;
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function createRangeItem(start: string, end: string) {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return { id, start, end: end || start };
}

type FiltersState = {
  employeeId: string;
  page: number;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: ReportData }
  | { status: "error"; message: string };

function buildCsv(report: ReportData) {
  const headers = ["วันที่", "ร้านค้า", "จังหวัด", "เวลาเข้า", "เวลาออก", "ชั่วโมง", "หมายเหตุ"];
  const rows: string[][] = [];

  report.rows.forEach((row) => {
    const isMultiStore = row.sessions.length > 1 && row.status === "present";

    if (row.status === "leave" && row.leaveType) {
      // Leave row
      rows.push([
        `${row.dayLabel} (${row.dayOfWeek})`,
        "ลา",
        "",
        "",
        "",
        "",
        row.leaveType,
      ]);
    } else if (row.status === "day-off") {
      // Day off row
      rows.push([
        `${row.dayLabel} (${row.dayOfWeek})`,
        "OFF",
        "",
        "",
        "",
        "",
        "วันหยุดประจำ",
      ]);
    } else if (row.status === "absent") {
      // Absent row
      rows.push([
        `${row.dayLabel} (${row.dayOfWeek})`,
        "หยุด",
        "",
        "",
        "",
        "",
        "ขาดงาน",
      ]);
    } else if (isMultiStore) {
      // Multi-store: parent row + sub-rows
      rows.push([
        `${row.dayLabel} (${row.dayOfWeek})`,
        `${row.storeCount} ร้าน`,
        "",
        row.firstCheckInTime,
        row.lastCheckOutTime,
        row.totalWorkingHours,
        "",
      ]);
      row.sessions.forEach((session, idx) => {
        const prefix = idx === row.sessions.length - 1 ? "└─" : "├─";
        rows.push([
          "",
          `${prefix} ${session.storeName}`,
          session.storeProvince || "",
          session.checkInTime,
          session.checkOutTime,
          session.workingHours,
          "",
        ]);
      });
    } else {
      // Single store row
      rows.push([
        `${row.dayLabel} (${row.dayOfWeek})`,
        row.storeName || "-",
        row.storeProvince || "",
        row.checkInTime,
        row.checkOutTime,
        row.workingHours,
        "",
      ]);
    }
  });
  const all = [headers, ...rows];
  const csvContent = all.map((cols) =>
    cols
      .map((value) => {
        if (value === null || value === undefined) return "";
        const needsQuote = /[",]/.test(value);
        if (!needsQuote) return value;
        return `"${value.replace(/"/g, '""')}"`;
      })
      .join(","),
  ).join("\r");

  // เพิ่ม BOM (Byte Order Mark) เพื่อให้ Excel รู้ว่าเป็น UTF-8
  return "\uFEFF" + csvContent;
}

function buildExcelXml(report: ReportData) {
  const headerRow = `
    <Row>
      <Cell><Data ss:Type="String">วันที่</Data></Cell>
      <Cell><Data ss:Type="String">ร้านค้า</Data></Cell>
      <Cell><Data ss:Type="String">จังหวัด</Data></Cell>
      <Cell><Data ss:Type="String">เวลาเข้า</Data></Cell>
      <Cell><Data ss:Type="String">เวลาออก</Data></Cell>
      <Cell><Data ss:Type="String">ชั่วโมง</Data></Cell>
      <Cell><Data ss:Type="String">หมายเหตุ</Data></Cell>
    </Row>
  `;

  const dataRows = report.rows
    .map((row) => {
      const isMultiStore = row.sessions.length > 1 && row.status === "present";

      if (row.status === "leave" && row.leaveType) {
        // Leave row
        return `
        <Row>
          <Cell><Data ss:Type="String">${row.dayLabel} (${row.dayOfWeek})</Data></Cell>
          <Cell><Data ss:Type="String">ลา</Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String">${row.leaveType}</Data></Cell>
        </Row>
      `;
      } else if (row.status === "day-off") {
        // Day off row
        return `
        <Row>
          <Cell><Data ss:Type="String">${row.dayLabel} (${row.dayOfWeek})</Data></Cell>
          <Cell><Data ss:Type="String">OFF</Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String">วันหยุดประจำ</Data></Cell>
        </Row>
      `;
      } else if (row.status === "absent") {
        // Absent row
        return `
        <Row>
          <Cell><Data ss:Type="String">${row.dayLabel} (${row.dayOfWeek})</Data></Cell>
          <Cell><Data ss:Type="String">หยุด</Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String">ขาดงาน</Data></Cell>
        </Row>
      `;
      } else if (isMultiStore) {
        // Multi-store: parent row + sub-rows
        const parentRow = `
        <Row>
          <Cell><Data ss:Type="String">${row.dayLabel} (${row.dayOfWeek})</Data></Cell>
          <Cell><Data ss:Type="String">${row.storeCount} ร้าน</Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String">${row.firstCheckInTime}</Data></Cell>
          <Cell><Data ss:Type="String">${row.lastCheckOutTime}</Data></Cell>
          <Cell><Data ss:Type="String">${row.totalWorkingHours}</Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
        </Row>
      `;
        const subRows = row.sessions
          .map((session, idx) => {
            const prefix = idx === row.sessions.length - 1 ? "└─" : "├─";
            return `
        <Row>
          <Cell><Data ss:Type="String"></Data></Cell>
          <Cell><Data ss:Type="String">${prefix} ${session.storeName}</Data></Cell>
          <Cell><Data ss:Type="String">${session.storeProvince || ""}</Data></Cell>
          <Cell><Data ss:Type="String">${session.checkInTime}</Data></Cell>
          <Cell><Data ss:Type="String">${session.checkOutTime}</Data></Cell>
          <Cell><Data ss:Type="String">${session.workingHours}</Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
        </Row>
      `;
          })
          .join("");
        return parentRow + subRows;
      } else {
        // Single store row
        return `
        <Row>
          <Cell><Data ss:Type="String">${row.dayLabel} (${row.dayOfWeek})</Data></Cell>
          <Cell><Data ss:Type="String">${row.storeName || "-"}</Data></Cell>
          <Cell><Data ss:Type="String">${row.storeProvince || ""}</Data></Cell>
          <Cell><Data ss:Type="String">${row.checkInTime}</Data></Cell>
          <Cell><Data ss:Type="String">${row.checkOutTime}</Data></Cell>
          <Cell><Data ss:Type="String">${row.workingHours}</Data></Cell>
          <Cell><Data ss:Type="String"></Data></Cell>
        </Row>
      `;
      }
    })
    .join("");

  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Report">
    <Table>
      ${headerRow}
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ReportPageClient({ initialEmployees }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize state from URL or localStorage (lazy loading)
  const [filters, setFilters] = useState<FiltersState>(() => {
    // Check URL first
    const urlEmployeeId = searchParams.get("employeeId");
    const page = parseInt(searchParams.get("page") || "1", 10);

    // If URL has employeeId, use it
    if (urlEmployeeId) {
      return {
        employeeId: urlEmployeeId,
        page,
      };
    }

    // Otherwise, check localStorage (for refresh persistence)
    if (typeof window !== "undefined") {
      const savedEmployeeId = window.localStorage.getItem("attendance-report:last-employee-id");

      // Validate saved IDs exist in current data
      const isValidEmployee = savedEmployeeId && initialEmployees.some(e => e.id === savedEmployeeId);

      if (isValidEmployee) {
        return {
          employeeId: savedEmployeeId,
          page,
        };
      }
    }

    // Default: no employee selected (lazy loading)
    return {
      employeeId: "",
      page,
    };
  });

  // Note: Attendance report uses month-based pagination (1 month per page)
  // This is different from sales report which uses row-based pagination

  const [ranges, setRanges] = useState<RangeItem[]>(() => {
    // Try to read from URL
    const rangesParam = searchParams.get("ranges");
    if (rangesParam) {
      try {
        const parsed = JSON.parse(rangesParam) as Array<{ start: string; end: string }>;
        return parsed.map(r => createRangeItem(r.start, r.end));
      } catch {
        // Fall through to default
      }
    }

    // Default to current month
    const today = startOfToday();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    return [createRangeItem(toIsoDate(monthStart), toIsoDate(monthEnd))];
  });

  const [draftRange, setDraftRange] = useState<RangeItem>(() => {
    const today = startOfToday();
    const iso = toIsoDate(today);
    return createRangeItem(iso, iso);
  });

  const [state, setState] = useState<FetchState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const reportContainerRef = useRef<HTMLDivElement | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set()); // For mobile
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set()); // For desktop table

  const selectedEmployee = useMemo(
    () => initialEmployees.find((employee) => employee.id === filters.employeeId) ?? null,
    [filters.employeeId, initialEmployees],
  );

  // Save selected employee to localStorage (for refresh persistence)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (filters.employeeId) {
      window.localStorage.setItem("attendance-report:last-employee-id", filters.employeeId);
    } else {
      window.localStorage.removeItem("attendance-report:last-employee-id");
    }
  }, [filters.employeeId]);

  // Sync filters and ranges to URL
  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.employeeId) params.set("employeeId", filters.employeeId);
    params.set("page", String(filters.page));

    if (ranges.length > 0) {
      const rangesData = ranges.map(r => ({ start: r.start, end: r.end }));
      params.set("ranges", JSON.stringify(rangesData));
    }

    router.replace(`?${params.toString()}`, { scroll: false });
  }, [filters, ranges, router]);

  useEffect(() => {
    if (!filters.employeeId) {
      setState({ status: "idle" });
      return;
    }

    if (ranges.length === 0) {
      setState({ status: "error", message: "กรุณาเลือกช่วงวันที่อย่างน้อย 1 รายการ" });
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    params.set("employeeId", filters.employeeId);
    params.set("page", String(filters.page));
    params.set("pageSize", "1"); // 1 month per page
    ranges.forEach((range) => {
      params.append("range", `${range.start}:${range.end}`);
    });

    setState({ status: "loading" });
    void fetch(`/api/admin/reports/attendance?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(data?.message ?? "ไม่สามารถโหลดรายงานได้");
        }
        const payload = (await response.json()) as { data: ReportData };
        setState({ status: "success", data: payload.data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "ไม่สามารถโหลดรายงานได้";
        setState({ status: "error", message });
      });

    return () => {
      controller.abort();
    };
  }, [filters, ranges]);

  const handleChange = (key: keyof FiltersState, value: string) => {
    setFilters((prev) => {
      if (key === "page") {
        return { ...prev, page: Number(value) };
      }
      if (key === "employeeId") {
        return {
          ...prev,
          employeeId: value,
          page: 1,
        };
      }
      return prev;
    });
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleAddRangeInternal = useCallback(
    (startIso: string, endIso: string) => {
      const start = startIso.trim();
      if (!start) return;
      const end = (endIso && endIso.trim()) || start;
      const [normalizedStart, normalizedEnd] = start <= end ? [start, end] : [end, start];
      setRanges([createRangeItem(normalizedStart, normalizedEnd)]);
      setFilters((prev) => ({ ...prev, page: 1 }));
    },
    [setRanges, setFilters],
  );

  const handleAddDraftRange = useCallback(() => {
    handleAddRangeInternal(draftRange.start, draftRange.end);
    const today = startOfToday();
    const iso = toIsoDate(today);
    setDraftRange(createRangeItem(iso, iso));
  }, [draftRange.end, draftRange.start, handleAddRangeInternal]);

  const handleRemoveRange = useCallback(
    (id: string) => {
      setRanges((prev) => prev.filter((range) => range.id !== id));
      setFilters((prev) => ({ ...prev, page: 1 }));
    },
    [setRanges, setFilters],
  );

  const handleQuickRange = useCallback(
    (preset: "today" | "thisWeek" | "thisMonth" | "lastMonth" | "last30") => {
      const today = startOfToday();
      if (preset === "today") {
        const iso = toIsoDate(today);
        handleAddRangeInternal(iso, iso);
        return;
      }
      if (preset === "thisWeek") {
        const start = startOfWeek(today);
        const end = endOfWeek(today);
        handleAddRangeInternal(toIsoDate(start), toIsoDate(end));
        return;
      }
      if (preset === "thisMonth") {
        const start = startOfMonth(today);
        const end = endOfMonth(today);
        handleAddRangeInternal(toIsoDate(start), toIsoDate(end));
        return;
      }
      if (preset === "lastMonth") {
        const lastMonthDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
        const start = startOfMonth(lastMonthDate);
        const end = endOfMonth(lastMonthDate);
        handleAddRangeInternal(toIsoDate(start), toIsoDate(end));
        return;
      }
      if (preset === "last30") {
        const end = toIsoDate(today);
        const startDate = new Date(today);
        startDate.setUTCDate(startDate.getUTCDate() - 29);
        handleAddRangeInternal(toIsoDate(startDate), end);
      }
    },
    [handleAddRangeInternal],
  );

  const handleClearRanges = useCallback(() => {
    setRanges([]);
    setFilters((prev) => ({ ...prev, page: 1 }));
  }, [setRanges, setFilters]);

  const handleExportCsv = () => {
    if (state.status !== "success") return;
    const csv = buildCsv(state.data);
    const filename = `attendance-report-${state.data.employee.name}-${Date.now()}.csv`;
    downloadBlob(csv, "text/csv;charset=utf-8", filename);
  };

  const handleExportExcel = () => {
    if (state.status !== "success") return;
    const xml = buildExcelXml(state.data);
    const filename = `attendance-report-${state.data.employee.name}-${Date.now()}.xls`;
    downloadBlob(xml, "application/vnd.ms-excel", filename);
  };

  const handlePrint = async () => {
    if (state.status !== "success" || !state.data) return;

    // Supervisor signature should always be blank
    const supervisorSignatureName = "";
    void supervisorSignatureName;

    // Fetch all months data for printing
    const allMonthsData: Array<{ month: MonthInfo; rows: ReportRow[] }> = [];

    try {
      setState({ status: "loading" });

      for (let page = 1; page <= state.data.pagination!.totalPages; page++) {
        const params = new URLSearchParams();
        params.set("employeeId", filters.employeeId);
        params.set("page", String(page));
        params.set("pageSize", "1"); // 1 month per page
        ranges.forEach((range) => {
          params.append("range", `${range.start}:${range.end}`);
        });

        const response = await fetch(`/api/admin/reports/attendance?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to load month data");

        const result = await response.json();
        if (result.ok && result.data) {
          allMonthsData.push({
            month: result.data.currentMonth,
            rows: result.data.rows,
          });
        }
      }

      // Restore current state
      setState({ status: "success", data: state.data });
    } catch (error) {
      console.error("Failed to load all months for printing:", error);
      setState({ status: "success", data: state.data });
      alert("ไม่สามารถโหลดข้อมูลทั้งหมดสำหรับพิมพ์ได้");
      return;
    }

    const logoUrl = getBrandingLogoUrl(state.data.branding.logoPath, state.data.branding.updatedAt, {
      origin: window.location.origin,
    });
    const printTimestamp = new Intl.DateTimeFormat("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());

    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>รายงานพนักงาน - ${state.data.employee.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.3;
      color: #000;
      position: relative;
    }

    .container {
      width: 100%;
      max-width: 210mm;
      min-height: 277mm;
      max-height: 277mm;
      margin: 0 auto;
      padding: 0;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 4px;
      padding: 6px 8px 4px 8px;
      border-bottom: 2px solid #333;
      flex-shrink: 0;
    }

    .company-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .company-logo {
      width: 96px;
      height: 96px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #e2e8f0;
      border-radius: 8px;
      padding: 8px;
    }

    .company-logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    }

    .company-logo img[data-loaded="true"] {
      opacity: 1;
    }

    .company-info h1 {
      font-size: 15px;
      font-weight: bold;
      margin-bottom: 2px;
    }

    .company-info p {
      font-size: 10px;
      color: #333;
      line-height: 1.2;
    }

    .employee-info {
      text-align: right;
      font-size: 10px;
      line-height: 1.3;
    }

    .details {
      display: flex;
      justify-content: space-between;
      margin: 3px 0 4px 0;
      padding: 0 8px;
      gap: 10px;
      flex-shrink: 0;
      font-size: 10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 5px 0 6px 0;
      font-size: 9px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      flex-grow: 1;
    }

    th {
      background: linear-gradient(90deg, #2563eb, #1d4ed8);
      border: 1px solid #1e3a8a;
      padding: 3px 2px;
      text-align: center;
      font-weight: bold;
      color: #f8fafc;
      font-size: 9px;
    }

    td {
      border: 1px solid #333;
      padding: 2px 3px;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 9px;
    }

    .absent {
      color: red;
      font-weight: bold;
    }

    .summary {
      margin-top: 4px;
      padding: 5px 8px;
      border: 1px solid #333;
      text-align: center;
      font-size: 9px;
      flex-shrink: 0;
    }

    .signatures {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      page-break-inside: avoid;
      flex-shrink: 0;
    }

    .signature-row {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      gap: 8px;
      page-break-inside: avoid;
      margin-top: 4px;
    }

    .signature-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      flex: 1 1 0;
      min-width: 0;
      border: 1px solid #333;
      padding: 15px 6px 6px 6px;
      background: #fafafa;
    }

    .signature-inline {
      display: flex;
      align-items: baseline;
      gap: 3px;
      font-size: 8.5px;
      white-space: nowrap;
    }

    .signature-line {
      display: inline-block;
      border-bottom: 1px solid #333;
      min-width: 75px;
      width: 75px;
    }

    .signature-name {
      font-size: 9px;
      color: #333;
      margin-top: 2px;
      white-space: nowrap;
      text-align: center;
      min-width: 100px;
    }

    .signature-date {
      font-size: 8px;
      color: #666;
      margin-top: 2px;
    }

    .page-break {
      page-break-after: always;
    }

    .month-title {
      font-size: 15px;
      font-weight: bold;
      margin: 6px 0 8px 0;
      text-align: center;
      color: #1e40af;
    }

    .page-number {
      display: none;
    }

    @media print {
      .container {
        padding: 0;
        position: relative;
      }
      .page-number {
        display: none;
      }
    }
  </style>
</head>
<body>
  ${allMonthsData
    .map((monthData, index) => {
      const presentDayCount = monthData.rows.filter((row) => row.status === "present").length;
      const presentDayLabel = THAI_INTEGER_FORMATTER.format(presentDayCount);
      const allowanceTotal = presentDayCount * DAILY_ALLOWANCE_RATE;
      const allowanceTotalLabel = THAI_INTEGER_FORMATTER.format(allowanceTotal);

      return `
  <div class="container${index < allMonthsData.length - 1 ? " page-break" : ""}">
    <header>
      <div class="company-info">
        <div class="company-logo">
          <img src="${logoUrl}" alt="โลโก้บริษัท" onload="this.setAttribute('data-loaded', 'true')" />
        </div>
        <div>
          <h1>บริษัทเคพีฟู้ดส์ จำกัด</h1>
          <p>ใบแจ้งหนี้ทริปทำงานพนักงานPC${state.data.employee.region ? `เขต${state.data.employee.region}` : ""}</p>
        </div>
      </div>
      <div class="employee-info">
        <p>พนักงานPC ${state.data.employee.province ? `จ.${state.data.employee.province}` : ""}</p>
        <p>ช่วงรายงาน: ${state.data.filters.rangeSummary}</p>
      </div>
    </header>

    <div class="month-title">${monthData.month.monthLabel}</div>

    <div class="details">
      <div>
        <p><strong>ชื่อพนักงานPC:</strong> ${state.data.employee.name}</p>
        <p><strong>ร้านค้า:</strong> ${state.data.store?.name ?? "ทั้งหมด"}</p>
      </div>
      <div style="text-align: right;">
        <p><strong>เบอร์โทร:</strong> ${state.data.employee.phone ?? "-"}</p>
        <p><strong>พิมพ์เอกสารเมื่อ:</strong> ${printTimestamp}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>วันที่</th>
          <th>ร้านค้า</th>
          <th>จังหวัด</th>
          <th>เวลาเข้า</th>
          <th>เวลาออก</th>
          <th>ชั่วโมง</th>
          <th>หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>
        ${monthData.rows
          .map(
            (row) => {
              const isMultiStore = row.sessions.length > 1 && row.status === "present";

              if (row.status === "leave" && row.leaveType) {
                // Leave row
                return `
          <tr>
            <td>${row.day} (${row.dayOfWeek})</td>
            <td><span style="color: #16a34a; font-weight: bold;">ลา</span></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>${row.leaveType}</td>
          </tr>
        `;
              } else if (row.status === "day-off") {
                // Day off row
                return `
          <tr>
            <td>${row.day} (${row.dayOfWeek})</td>
            <td><span style="color: #3b82f6; font-weight: bold;">OFF</span></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>วันหยุดประจำ</td>
          </tr>
        `;
              } else if (row.status === "absent") {
                // Absent row
                return `
          <tr>
            <td>${row.day} (${row.dayOfWeek})</td>
            <td><span class="absent">หยุด</span></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>ขาดงาน</td>
          </tr>
        `;
              } else if (isMultiStore) {
                // Multi-store: parent row + sub-rows (always expanded in print)
                const parentRow = `
          <tr>
            <td>${row.day} (${row.dayOfWeek})</td>
            <td>${row.storeCount} ร้าน</td>
            <td></td>
            <td>${row.firstCheckInTime}</td>
            <td>${row.lastCheckOutTime}</td>
            <td>${row.totalWorkingHours}</td>
            <td></td>
          </tr>
        `;
                const subRows = row.sessions
                  .map((session, idx) => {
                    const prefix = idx === row.sessions.length - 1 ? '└─' : '├─';
                    return `
          <tr style="background: #f8fafc;">
            <td></td>
            <td style="text-align: left; padding-left: 20px;">${prefix} ${session.storeName}</td>
            <td>${session.storeProvince || ""}</td>
            <td>${session.checkInTime}</td>
            <td>${session.checkOutTime}</td>
            <td>${session.workingHours}</td>
            <td></td>
          </tr>
        `;
                  })
                  .join("");
                return parentRow + subRows;
              } else {
                // Single store row
                return `
          <tr>
            <td>${row.day} (${row.dayOfWeek})</td>
            <td>${row.storeName ?? "-"}</td>
            <td>${row.storeProvince ?? ""}</td>
            <td>${row.checkInTime || ""}</td>
            <td>${row.checkOutTime || ""}</td>
            <td>${row.workingHours || ""}</td>
            <td></td>
          </tr>
        `;
              }
            }
          )
          .join("")}
      </tbody>
    </table>

    <div class="summary">
      <p>
        <strong>ทริปเดินทาง จำนวน ${presentDayLabel} วัน</strong> |
        เบี้ยเลี้ยง ${DAILY_ALLOWANCE_RATE} บาท/วัน |
        <strong>สำรองจ่าย ${allowanceTotalLabel} บาท</strong>
      </p>
    </div>

    ${index === allMonthsData.length - 1 ? `
    <div class="signatures">
      <div class="signature-row">
        <!-- 1. พนักงาน -->
        <div class="signature-cell">
          <div class="signature-inline">
            <span>ลงชื่อ</span>
            <span class="signature-line"></span>
            <span>พนักงาน</span>
          </div>
          <span class="signature-name">(${state.data.employee.name})</span>
          <span class="signature-date">วันที่ ___/___/___</span>
        </div>
        <!-- 2. ผู้ตรวจสอบ -->
        <div class="signature-cell">
          <div class="signature-inline">
            <span>ลงชื่อ</span>
            <span class="signature-line"></span>
            <span>ผู้ตรวจสอบ</span>
          </div>
          <span class="signature-name">(.....................)</span>
          <span class="signature-date">วันที่ ___/___/___</span>
        </div>
        <!-- 3. ซูเปอร์ไวเซอร์ -->
        <div class="signature-cell">
          <div class="signature-inline">
            <span>ลงชื่อ</span>
            <span class="signature-line"></span>
            <span>ซูเปอร์ไวเซอร์</span>
          </div>
          <span class="signature-name">(.....................)</span>
          <span class="signature-date">วันที่ ___/___/___</span>
        </div>
        <!-- 4. ผู้อนุมัติ -->
        <div class="signature-cell">
          <div class="signature-inline">
            <span>ลงชื่อ</span>
            <span class="signature-line"></span>
            <span>ผู้อนุมัติ</span>
          </div>
          <span class="signature-name">(.....................)</span>
          <span class="signature-date">วันที่ ___/___/___</span>
        </div>
      </div>
    </div>
    ` : ''}

    <div class="page-number">หน้า ${index + 1} / ${allMonthsData.length}</div>
  </div>
      `;
    })
    .join("")}
</body>
</html>
    `;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };
  if (initialEmployees.length === 0) {
    return (
      <div className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900 -mt-4 mb-2">รายงาน</h1>
          <p className="text-sm text-slate-500">
            กรุณาเพิ่มรายชื่อพนักงานก่อน เพื่อสร้างรายงานการทำงาน
          </p>
        </header>
        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-700 shadow-inner">
          ยังไม่มีข้อมูลพนักงาน
        </div>
      </div>
    );
  }

  const toolbarDisabled = state.status === "loading";
  const report = state.status === "success" ? state.data : null;
  const displayLogo =
    getBrandingLogoSrc(
      report?.branding.logoPath ?? null,
      report?.branding.updatedAt ?? null,
      FALLBACK_LOGO,
    ) ?? FALLBACK_LOGO;
  const rangeSummary =
    report?.filters.rangeSummary ??
    (ranges.length > 0
      ? ranges
          .map((range) =>
            range.start === range.end ? range.start : `${range.start} ถึง ${range.end}`,
          )
          .join(", ")
      : "ยังไม่ระบุช่วงวันที่");
  const presentDayCount = report
    ? report.rows.filter((row) => row.status === "present").length
    : 0;
  const presentDayLabel = THAI_INTEGER_FORMATTER.format(presentDayCount);
  const allowanceTotal = presentDayCount * DAILY_ALLOWANCE_RATE;
  const allowanceTotalLabel = THAI_INTEGER_FORMATTER.format(allowanceTotal);

  // Column definitions for desktop table
  // Toggle expand/collapse row for mobile
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const toggleRow = useCallback((dateIso: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dateIso)) {
        newSet.delete(dateIso);
      } else {
        newSet.add(dateIso);
      }
      return newSet;
    });
  }, []);

  // Toggle expand/collapse date for desktop table
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const toggleDate = useCallback((dateIso: string) => {
    setExpandedDates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dateIso)) {
        newSet.delete(dateIso);
      } else {
        newSet.add(dateIso);
      }
      return newSet;
    });
  }, []);

  return (
    <>
    <div id="report-print-root" className="space-y-6 print:space-y-0">
      <header className="space-y-3 print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900 -mt-4 mb-2">รายงานพนักงาน</h1>
        <p className="text-sm text-slate-500">
          สร้างสรุปการทำงานรายเดือนแบบฟอร์ม A4 พร้อมตัวกรองและปริ้นได้ทันที
        </p>
      </header>

      <section className="print:hidden rounded-3xl border border-blue-100 bg-white/90 p-3 sm:p-5 shadow-[0_30px_120px_-110px_rgba(37,99,235,0.8)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">พนักงาน *</label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
              value={filters.employeeId}
              onChange={(event) => handleChange("employeeId", event.target.value)}
              disabled={toolbarDisabled}
            >
              <option value="">เลือกพนักงาน</option>
              {initialEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>


          <div className="space-y-3 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">ช่วงวันที่</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleQuickRange("today")}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={toolbarDisabled}
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={() => handleQuickRange("thisWeek")}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={toolbarDisabled}
              >
                สัปดาห์นี้
              </button>
              <button
                type="button"
                onClick={() => handleQuickRange("thisMonth")}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={toolbarDisabled}
              >
                เดือนนี้
              </button>
              <button
                type="button"
                onClick={() => handleQuickRange("lastMonth")}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={toolbarDisabled}
              >
                เดือนก่อน
              </button>
              <button
                type="button"
                onClick={() => handleQuickRange("last30")}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={toolbarDisabled}
              >
                30 วันที่ผ่านมา
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={draftRange.start}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setDraftRange((prev) => ({ ...prev, start: event.target.value }))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none"
                disabled={toolbarDisabled}
              />
              <span className="text-xs font-medium text-slate-500">ถึง</span>
              <input
                type="date"
                value={draftRange.end}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setDraftRange((prev) => ({ ...prev, end: event.target.value }))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none"
                disabled={toolbarDisabled}
              />
              <button
                type="button"
                onClick={handleAddDraftRange}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 px-4 py-2 text-xs font-semibold !text-white shadow-[0_12px_40px_-30px_rgba(37,99,235,0.9)] transition disabled:cursor-not-allowed disabled:opacity-60"
                disabled={toolbarDisabled || !draftRange.start}
              >
                เพิ่มช่วง
              </button>
              {ranges.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearRanges}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={toolbarDisabled}
                >
                  ล้างทั้งหมด
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {ranges.length === 0 && (
                <span className="rounded-full border border-dashed border-slate-200 px-3 py-1 text-xs text-slate-500">
                  ยังไม่ได้เลือกช่วงวันที่
                </span>
              )}
              {ranges.map((range) => (
                <span
                  key={range.id}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/70 px-3 py-1 text-xs font-medium text-blue-700 shadow-sm"
                >
                  <span>
                    {range.start === range.end
                      ? range.start
                      : `${range.start} ถึง ${range.end}`}
                  </span>
                  <button
                    type="button"
                    className="rounded-full border border-transparent px-2 py-0.5 text-blue-600 transition hover:border-blue-400 hover:bg-white"
                    onClick={() => handleRemoveRange(range.id)}
                    disabled={toolbarDisabled}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePrint}
            disabled={state.status !== "success"}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_60px_-35px_rgba(37,99,235,1)] transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            พิมพ์ / PDF
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={state.status !== "success"}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ดาวน์โหลด CSV
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={state.status !== "success"}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ดาวน์โหลด Excel
          </button>
          {state.status === "loading" && (
            <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-600 shadow-inner">
              กำลังโหลดรายงาน...
            </span>
          )}
          {state.status === "error" && (
            <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-4 py-2 text-xs font-medium text-red-600 shadow-inner">
              {state.message}
            </span>
          )}
        </div>

        {/* Pagination Controls */}
        {state.status === "success" && state.data.pagination && state.data.currentMonth && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-slate-700">
                {state.data.currentMonth.monthLabel}
              </span>
              <span className="text-sm text-slate-500">
                ({state.data.rows.length} วัน)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(state.data.pagination!.page - 1)}
                disabled={!state.data.pagination.hasPrevPage}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                เดือนก่อนหน้า
              </button>
              <span className="px-3 text-sm text-slate-600">
                เดือน {state.data.pagination.page} จาก {state.data.pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(state.data.pagination!.page + 1)}
                disabled={!state.data.pagination.hasNextPage}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                เดือนถัดไป
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Wrapper specifically for printing */}
      <div id="print-report-wrapper" style={{ display: "none" }}>
        <div className="print-page">
          {report && (
            <>
              <header className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2">
                    <Image
                      src={displayLogo}
                      alt="โลโก้บริษัท"
                      fill
                      sizes="96px"
                      className="object-contain"
                      priority
                      unoptimized={displayLogo.startsWith("http")}
                      placeholder="blur"
                      blurDataURL="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e2e8f0'/%3E%3C/svg%3E"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-slate-900">
                      บริษัทเคพีฟู้ดส์ จำกัด
                    </p>
                    <p className="text-sm text-slate-600">
                      ใบแจ้งหนี้ทริปทำงานพนักงานPC
                      {selectedEmployee?.region ? `เขต${selectedEmployee.region}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <p>
                    พนักงานPC{" "}
                    {selectedEmployee?.province ? `จ.${selectedEmployee.province}` : ""}
                  </p>
                  <p>ช่วงรายงาน: {rangeSummary}</p>
                </div>
              </header>

              <div className="flex items-start justify-between text-sm text-slate-700 mb-4">
                <div>
                  <p>
                    ชื่อพนักงานPC{" "}
                    <span className="font-semibold text-slate-900">
                      {selectedEmployee?.name ?? "-"}
                    </span>
                  </p>
                  <p>
                    ร้านค้า{" "}
                    <span className="font-semibold text-slate-900">
                      ทั้งหมด
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p>
                    เบอร์โทร{" "}
                    <span className="font-semibold text-slate-900">
                      {selectedEmployee?.phone ?? "-"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Desktop Table */}
              <div className="desktop-table mb-4">
                <style jsx>{`
                  .desktop-table {
                    display: block;
                  }
                  .mobile-cards {
                    display: none;
                  }
                  @media (max-width: 1024px) {
                    .desktop-table {
                      display: none;
                    }
                    .mobile-cards {
                      display: block;
                    }
                  }
                `}</style>
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-200 px-2 py-2 text-center text-sm">วันที่</th>
                      <th className="border border-slate-200 px-2 py-2 text-center text-sm">ร้านค้า</th>
                      <th className="border border-slate-200 px-2 py-2 text-center text-sm">จังหวัด</th>
                      <th className="border border-slate-200 px-2 py-2 text-center text-sm">เวลาเข้า</th>
                      <th className="border border-slate-200 px-2 py-2 text-center text-sm">เวลาออก</th>
                      <th className="border border-slate-200 px-2 py-2 text-center text-sm">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => {
                      const notWorking = row.status !== "present";
                      const isFuture = row.status === "future";
                      let statusLabel = row.storeName ?? "-";
                      let statusClass = "";
                      let noteText = "";

                      if (isFuture) {
                        // Future date - show empty
                        statusLabel = "";
                        statusClass = "text-slate-300";
                        noteText = "";
                      } else if (row.status === "leave" && row.leaveType) {
                        statusLabel = "ลา";
                        statusClass = "font-semibold text-green-600";
                        noteText = row.leaveType;
                      } else if (row.status === "day-off") {
                        statusLabel = "OFF";
                        statusClass = "font-semibold text-blue-500";
                        noteText = "วันหยุดประจำ";
                      } else if (row.status === "absent") {
                        statusLabel = "หยุด";
                        statusClass = "font-semibold text-red-600";
                        noteText = "ขาดงาน";
                      }

                      return (
                        <tr key={row.dateIso} className={isFuture ? "bg-slate-50/30" : ""}>
                          <td className="border border-slate-200 px-2 py-2 text-center text-sm">
                            {row.day}
                          </td>
                          <td className="border border-slate-200 px-2 py-2 text-center text-sm">
                            <span className={statusClass}>{statusLabel}</span>
                          </td>
                          <td className="border border-slate-200 px-2 py-2 text-center text-sm">
                            {notWorking || isFuture ? "" : row.storeProvince ?? ""}
                          </td>
                          <td className="border border-slate-200 px-2 py-2 text-center text-sm">
                            {notWorking || isFuture ? "" : row.checkInTime || ""}
                          </td>
                          <td className="border border-slate-200 px-2 py-2 text-center text-sm">
                            {notWorking || isFuture ? "" : row.checkOutTime || ""}
                          </td>
                          <td className="border border-slate-200 px-2 py-2 text-center text-sm text-slate-600">
                            {noteText}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="mobile-cards mb-4 space-y-3">
                {report.rows.map((row) => {
                  const notWorking = row.status !== "present";
                  const isFuture = row.status === "future";
                  let statusBadge = null;

                  if (isFuture) {
                    // Future date - show empty badge
                    statusBadge = (
                      <span className="px-2 py-1 text-xs font-semibold text-slate-300 bg-slate-50 rounded">-</span>
                    );
                  } else if (row.status === "leave") {
                    statusBadge = (
                      <span className="px-2 py-1 text-xs font-semibold text-green-600 bg-green-50 rounded">ลา</span>
                    );
                  } else if (row.status === "day-off") {
                    statusBadge = (
                      <span className="px-2 py-1 text-xs font-semibold text-blue-500 bg-blue-50 rounded">OFF</span>
                    );
                  } else if (row.status === "absent") {
                    statusBadge = (
                      <span className="px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 rounded">หยุด</span>
                    );
                  }

                  return (
                    <div key={row.dateIso} className={`border border-slate-200 rounded-lg p-3 shadow-sm ${isFuture ? "bg-slate-50/30" : "bg-white"}`}>
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
                        <span className="text-lg font-semibold text-slate-900">วันที่ {row.day}</span>
                        {statusBadge}
                      </div>
                      {!notWorking && !isFuture && (
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">ร้านค้า:</span>
                            <span className="font-medium text-slate-900">{row.storeName ?? "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">จังหวัด:</span>
                            <span className="font-medium text-slate-900">{row.storeProvince ?? "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">เวลาเข้า:</span>
                            <span className="font-medium text-slate-900">{row.checkInTime || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">เวลาออก:</span>
                            <span className="font-medium text-slate-900">{row.checkOutTime || "-"}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 text-center">
                <span className="whitespace-nowrap">
                  ทริปเดินทาง จำนวน <span className="font-semibold text-slate-900">{presentDayLabel}</span> วัน
                </span>
                <span className="hidden min-h-[16px] w-px bg-slate-300 sm:block" />
                <span className="whitespace-nowrap">เบี้ยเลี้ยง {DAILY_ALLOWANCE_RATE} บาท/วัน</span>
                <span className="hidden min-h-[16px] w-px bg-slate-300 sm:block" />
                <span className="flex items-center gap-2 whitespace-nowrap">
                  สำรองจ่าย
                  <span className="font-semibold text-slate-900">{allowanceTotalLabel}</span>
                  บาท
                </span>
              </div>

              <div className="mt-6 space-y-6 text-sm text-slate-700">
                <div className="grid w-full gap-4 sm:grid-cols-2">
                  <div className="flex flex-nowrap items-center gap-2">
                    <span className={SIGNATURE_LABEL_CLASS}>ลงชื่อ</span>
                    <span className="font-semibold text-slate-900 whitespace-nowrap">
                      {selectedEmployee?.name ?? ""}
                    </span>
                    <span className={SIGNATURE_SPACER_LINE_CLASS} aria-hidden="true">
                      &nbsp;
                    </span>
                    <span>พนักงาน</span>
                  </div>
                  <div className="flex flex-nowrap items-center gap-2">
                    <span className={SIGNATURE_LABEL_CLASS}>ลงชื่อ</span>
                    <span className={SIGNATURE_LINE_BLANK_CLASS} aria-hidden="true">
                      &nbsp;
                    </span>
                    <span>ผู้อนุมัติ</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-2">
                  <span className={SIGNATURE_LABEL_CLASS}>ลงชื่อ</span>
                  <span className="font-semibold text-slate-900">
                    {selectedEmployee?.name || "..."}
                  </span>
                  <span className={SIGNATURE_SPACER_LINE_CLASS} aria-hidden="true">
                    &nbsp;
                  </span>
                  <span>ซูเปอร์ไวเซอร์/ผจก.ฝ่ายขาย</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <section className="space-y-4 print:space-y-0">
        <div className="no-print text-sm text-slate-500">
          แสดงผลสำหรับ:{" "}
          <span className="font-medium text-slate-700">
            {selectedEmployee?.name ?? "-"}
          </span>{" "}
          · {rangeSummary}
        </div>

        <div
          ref={reportContainerRef}
          id="report-print-container"
          className="mx-auto w-full max-w-[900px] border border-slate-200 bg-[#fdfdfc] p-4 md:p-8 shadow-[0_40px_140px_-100px_rgba(37,99,235,0.85)]"
        >
          <div className="mx-auto box-border flex w-full md:w-[210mm] min-h-[297mm] flex-col gap-6 rounded-[22px] bg-white p-4 md:p-[18mm] text-[13px] shadow-[0_0_1px_rgba(15,23,42,0.08)] print:min-h-[297mm] print:gap-3 print:rounded-none print:p-[10mm] print:text-[11px] print:shadow-none">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 print:h-12 print:w-12">
                  <Image
                    src={displayLogo}
                    alt="โลโก้บริษัท"
                    fill
                    sizes="64px"
                    className="object-contain"
                    priority
                    unoptimized={displayLogo.startsWith("http")}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-slate-900 whitespace-nowrap">
                    บริษัทเคพีฟู้ดส์ จำกัด
                  </p>
                  <p className="text-sm text-slate-600">
                    ใบแจ้งหนี้ทริปทำงานพนักงานPC
                    {selectedEmployee?.region ? `เขต${selectedEmployee.region}` : ""}
                  </p>
                </div>
              </div>
              <div className="hidden md:block text-right text-sm text-slate-600">
                <p>
                  พนักงานPC{" "}
                  {selectedEmployee?.province ? `จ.${selectedEmployee.province}` : ""}
                </p>
                <p>ช่วงรายงาน: {rangeSummary}</p>
              </div>
            </header>

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-0 text-sm text-slate-700 print:flex-row print:items-start print:justify-between print:text-[11px]">
              {/* Mobile Layout */}
              <div className="md:hidden space-y-2">
                <p className="text-sm">
                  <span className="text-xs font-medium text-slate-600">พนักงาน PC:</span>{" "}
                  <span className="font-semibold text-slate-900">
                    {selectedEmployee?.province ? `จ.${selectedEmployee.province}` : "-"}
                  </span>
                </p>
                <p className="text-sm">
                  <span className="text-xs font-medium text-slate-600">ช่วงรายงาน:</span>{" "}
                  <span className="font-semibold text-slate-900">
                    {rangeSummary}
                  </span>
                </p>
                <p className="text-sm">
                  <span className="text-xs font-medium text-slate-600">ชื่อพนักงาน PC:</span>{" "}
                  <span className="font-semibold text-slate-900">
                    {selectedEmployee?.name ?? "-"}
                  </span>
                </p>
                <p className="text-sm">
                  <span className="text-xs font-medium text-slate-600">ร้านค้า:</span>{" "}
                  <span className="font-semibold text-slate-900">
                    ทั้งหมด
                  </span>
                </p>
                <p className="text-sm">
                  <span className="text-xs font-medium text-slate-600">เบอร์โทร:</span>{" "}
                  <span className="font-semibold text-slate-900">
                    {selectedEmployee?.phone ?? "-"}
                  </span>
                </p>
              </div>

              {/* Desktop/Print Layout */}
              <div className="hidden md:block">
                <p>
                  ชื่อพนักงานPC{" "}
                  <span className="font-semibold text-slate-900">
                    {selectedEmployee?.name ?? "-"}
                  </span>
                </p>
                <p>
                  ร้านค้า{" "}
                  <span className="font-semibold text-slate-900">
                    ทั้งหมด
                  </span>
                </p>
              </div>
              <div className="hidden md:block text-right">
                <p>
                  เบอร์โทร{" "}
                  <span className="font-semibold text-slate-900">
                    {selectedEmployee?.phone ?? "-"}
                  </span>
                </p>
              </div>
            </div>

            {/* Desktop Table - Hidden on mobile */}
            {report && (
              <div className="hidden md:block">
                <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm print:rounded-lg">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500">
                        <th className="border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-white">วันที่</th>
                        <th className="border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-white">ร้านค้า</th>
                        <th className="border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-white">จังหวัด</th>
                        <th className="border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-white">เวลาเข้า</th>
                        <th className="border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-white">เวลาออก</th>
                        <th className="border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-white">ชั่วโมง</th>
                        <th className="border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-white">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row) => {
                        const isExpanded = expandedDates.has(row.dateIso);
                        const isMultiStore = row.sessions.length > 1 && row.status === "present";
                        const isFuture = row.status === "future";

                        // Determine status display
                        let storeDisplay = row.storeName || "-";
                        let storeColor = "";
                        let noteText = "";
                        let noteColor = "";

                        if (isFuture) {
                          storeDisplay = "";
                          storeColor = "text-slate-300";
                          noteText = "";
                          noteColor = "text-slate-300";
                        } else if (row.status === "leave") {
                          storeDisplay = "ลา";
                          storeColor = "font-semibold text-green-600";
                          noteText = row.leaveType || "";
                          noteColor = "text-green-700";
                        } else if (row.status === "day-off") {
                          storeDisplay = "OFF";
                          storeColor = "font-semibold text-blue-500";
                          noteText = "วันหยุดประจำ";
                          noteColor = "text-blue-600";
                        } else if (row.status === "absent") {
                          storeDisplay = "หยุด";
                          storeColor = "font-semibold text-red-600";
                          noteText = "ขาดงาน";
                          noteColor = "text-red-600";
                        } else if (isMultiStore) {
                          storeDisplay = `${row.storeCount} ร้าน`;
                        }

                        return (
                          <React.Fragment key={row.dateIso}>
                            {/* Parent Row */}
                            <tr
                              className={`${isMultiStore && !isFuture ? "cursor-pointer hover:bg-slate-50" : ""} ${row.status !== "present" || isFuture ? "bg-slate-50/50" : ""}`}
                              onClick={isMultiStore && !isFuture ? () => toggleDate(row.dateIso) : undefined}
                            >
                              <td className="border border-slate-200 px-4 py-2 text-center text-sm">
                                {row.dayLabel} ({row.dayOfWeek})
                              </td>
                              <td className={`border border-slate-200 px-4 py-2 text-center text-sm ${storeColor}`}>
                                {storeDisplay} {isMultiStore && !isFuture && (
                                  <span className="ml-1 text-slate-400">
                                    {isExpanded ? "▲" : "▼"}
                                  </span>
                                )}
                              </td>
                              <td className="border border-slate-200 px-4 py-2 text-center text-sm">
                                {row.status === "present" && !isMultiStore && !isFuture ? row.storeProvince || "" : ""}
                              </td>
                              <td className="border border-slate-200 px-4 py-2 text-center text-sm">
                                {row.status === "present" && !isFuture ? row.firstCheckInTime || row.checkInTime : ""}
                              </td>
                              <td className="border border-slate-200 px-4 py-2 text-center text-sm">
                                {row.status === "present" && !isFuture ? row.lastCheckOutTime || row.checkOutTime : ""}
                              </td>
                              <td className="border border-slate-200 px-4 py-2 text-center text-sm">
                                {row.status === "present" && !isFuture ? row.totalWorkingHours || row.workingHours : ""}
                              </td>
                              <td className={`border border-slate-200 px-4 py-2 text-center text-sm ${noteColor}`}>
                                {noteText}
                              </td>
                            </tr>

                            {/* Sub-rows for multi-store sessions (expanded) */}
                            {isMultiStore && isExpanded && row.sessions.map((session, idx) => (
                              <tr key={`${row.dateIso}-${idx}`} className="bg-slate-50/70">
                                <td className="border border-slate-200 px-4 py-2 text-center text-sm"></td>
                                <td className="border border-slate-200 px-4 py-2 text-left text-sm pl-8">
                                  {idx === row.sessions.length - 1 ? "└─" : "├─"} {session.storeName}
                                </td>
                                <td className="border border-slate-200 px-4 py-2 text-center text-sm">
                                  {session.storeProvince || ""}
                                </td>
                                <td className="border border-slate-200 px-4 py-2 text-center text-sm">
                                  {session.checkInTime}
                                </td>
                                <td className="border border-slate-200 px-4 py-2 text-center text-sm">
                                  {session.checkOutTime}
                                </td>
                                <td className="border border-slate-200 px-4 py-2 text-center text-sm">
                                  {session.workingHours}
                                </td>
                                <td className="border border-slate-200 px-4 py-2 text-center text-sm"></td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Mobile Progressive Disclosure - Hidden on desktop */}
            {report && (
              <div className="md:hidden space-y-2">
                {report.rows.map((row) => {
                  const isExpanded = expandedRows.has(row.dateIso);
                  const notWorking = row.status !== "present";
                  const isFuture = row.status === "future";

                  // Icon and colors based on status
                  let iconBg = "bg-blue-100";
                  let icon = "🏪";

                  if (isFuture) {
                    iconBg = "bg-slate-50";
                    icon = "📅";
                  } else if (row.status === "leave") {
                    iconBg = "bg-green-100";
                    icon = "🌴";
                  } else if (row.status === "day-off") {
                    iconBg = "bg-blue-100";
                    icon = "📅";
                  } else if (row.status === "absent") {
                    iconBg = "bg-red-100";
                    icon = "❌";
                  }

                  // Status label and color
                  const isMultiStore = row.sessions.length > 1 && row.status === "present";
                  let statusLabel = row.storeName || "-";
                  let statusColor = "text-slate-700";

                  if (isFuture) {
                    statusLabel = "";
                    statusColor = "text-slate-300";
                  } else if (row.status === "leave") {
                    statusLabel = "ลา";
                    statusColor = "text-green-600";
                  } else if (row.status === "day-off") {
                    statusLabel = "OFF";
                    statusColor = "text-blue-500";
                  } else if (row.status === "absent") {
                    statusLabel = "หยุด";
                    statusColor = "text-red-600";
                  } else if (isMultiStore) {
                    statusLabel = `${row.storeCount} ร้าน`;
                  }

                  return (
                    <div
                      key={row.dateIso}
                      className={`border border-slate-200 rounded-xl overflow-hidden transition-shadow ${isFuture ? "bg-slate-50/30" : "bg-white hover:shadow-md"}`}
                    >
                      {/* Collapsed View - Main Info */}
                      <button
                        onClick={!isFuture ? () => toggleRow(row.dateIso) : undefined}
                        disabled={isFuture}
                        className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors ${isFuture ? "cursor-default" : "hover:bg-slate-50"}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Icon */}
                          <div className="flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center`}>
                              <span className="text-xl">{icon}</span>
                            </div>
                          </div>

                          {/* Date */}
                          <div className="flex-shrink-0">
                            <div className="text-sm font-semibold text-slate-900">
                              {row.dayLabel}
                            </div>
                            <div className="text-xs text-slate-500">
                              {row.dayOfWeek} - วันที่ {row.day}
                            </div>
                          </div>

                          {/* Store Name / Status */}
                          <div className="flex-1 min-w-0 hidden sm:block">
                            <div className={`text-sm font-semibold ${statusColor} truncate`}>
                              {statusLabel}
                            </div>
                          </div>

                          {/* Time */}
                          {!notWorking && !isFuture && (
                            <div className="flex items-center gap-2 text-xs text-slate-600 flex-shrink-0">
                              <span>⏰</span>
                              <span>
                                {row.checkInTime || "-"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Expand Icon */}
                        <div className="flex-shrink-0">
                          <svg
                            className={`w-5 h-5 text-slate-400 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded View - Multi-Store Sessions */}
                      {isExpanded && !notWorking && isMultiStore && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/30">
                          <div className="mb-2 text-xs text-slate-600 font-medium">
                            รวม {row.storeCount} ร้าน • {row.totalWorkingHours}
                          </div>
                          <div className="space-y-2">
                            {row.sessions.map((session, idx) => (
                              <div key={idx} className="bg-white rounded-lg border border-slate-200 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs text-slate-500">📍</span>
                                  <div className="font-semibold text-sm text-slate-900">
                                    Session {idx + 1}: {session.storeName}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <div className="text-slate-600">จังหวัด</div>
                                    <div className="text-slate-900 font-medium">{session.storeProvince || "-"}</div>
                                  </div>
                                  <div>
                                    <div className="text-slate-600">ชั่วโมง</div>
                                    <div className="text-blue-600 font-semibold">{session.workingHours}</div>
                                  </div>
                                  <div className="col-span-2">
                                    <div className="text-slate-600">เวลา</div>
                                    <div className="text-slate-900 font-medium">
                                      ⏰ {session.checkInTime} → {session.checkOutTime}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Expanded View - Single Store Details */}
                      {isExpanded && !notWorking && !isMultiStore && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/50">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div className="flex items-start gap-2">
                              <span className="text-slate-500 text-xs mt-0.5">📍</span>
                              <div className="flex-1">
                                <div className="text-xs font-medium text-slate-600">
                                  จังหวัด
                                </div>
                                <div className="text-sm text-slate-900">
                                  {row.storeProvince || "-"}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <span className="text-slate-500 text-xs mt-0.5">⏰</span>
                              <div className="flex-1">
                                <div className="text-xs font-medium text-slate-600">
                                  เวลาเข้า-ออก
                                </div>
                                <div className="text-sm text-slate-900">
                                  {row.checkInTime || "-"} ถึง {row.checkOutTime || "-"}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <span className="text-slate-500 text-xs mt-0.5">⏱️</span>
                              <div className="flex-1">
                                <div className="text-xs font-medium text-slate-600">
                                  ชั่วโมงทำงาน
                                </div>
                                <div className="text-sm text-slate-900 font-semibold text-blue-600">
                                  {row.workingHours || "-"}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <span className="text-slate-500 text-xs mt-0.5">🏪</span>
                              <div className="flex-1">
                                <div className="text-xs font-medium text-slate-600">
                                  ร้านค้า
                                </div>
                                <div className="text-sm text-slate-900">
                                  {row.storeName || "-"}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start gap-2">
                              <span className="text-slate-500 text-xs mt-0.5">📞</span>
                              <div className="flex-1">
                                <div className="text-xs font-medium text-slate-600">
                                  โทรศัพท์
                                </div>
                                <div className="text-sm text-slate-900">
                                  {selectedEmployee?.phone || "-"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expanded View - Leave Day */}
                      {isExpanded && row.status === "leave" && (
                        <div className="px-4 pb-4 pt-2 border-t border-green-100 bg-green-50/30">
                          <div className="text-sm text-green-700 text-center">
                            วันนี้พนักงานลา
                          </div>
                        </div>
                      )}

                      {/* Expanded View - Day Off */}
                      {isExpanded && row.status === "day-off" && (
                        <div className="px-4 pb-4 pt-2 border-t border-blue-100 bg-blue-50/30">
                          <div className="text-sm text-blue-600 text-center">
                            วันหยุดประจำของพนักงาน
                          </div>
                        </div>
                      )}

                      {/* Expanded View - Absent Day */}
                      {isExpanded && row.status === "absent" && (
                        <div className="px-4 pb-4 pt-2 border-t border-red-100 bg-red-50/30">
                          <div className="text-sm text-red-600 text-center">
                            วันนี้พนักงานหยุดงาน / ขาดงาน
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 text-sm text-slate-700 print:hidden">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-md border border-slate-300 px-4 py-2 text-center">
                <span className="whitespace-nowrap">
                  ทริปเดินทาง จำนวน <span className="font-semibold text-slate-900">{presentDayLabel}</span> วัน
                </span>
                <span className="hidden min-h-[16px] w-px bg-slate-300 sm:block" />
                <span className="whitespace-nowrap">เบี้ยเลี้ยง {DAILY_ALLOWANCE_RATE} บาท/วัน</span>
                <span className="hidden min-h-[16px] w-px bg-slate-300 sm:block" />
                <span className="flex items-center gap-2 whitespace-nowrap">
                  สำรองจ่าย
                  <span className="font-semibold text-slate-900">{allowanceTotalLabel}</span>
                  บาท
                </span>
              </div>
            </div>
          </div>
        </div>

      </section>

    </div>
    </>
  );
}


