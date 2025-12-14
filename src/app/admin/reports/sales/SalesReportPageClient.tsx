"use client";

import Image from "next/image";
import { getBrandingLogoSrc, getBrandingLogoUrl } from "@/lib/branding";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

type EmployeeOption = {
  id: string;
  name: string;
  phone: string | null;
  province: string | null;
  region: string | null;
  regularDayOff: string | null;
  defaultStoreId: string | null;
};

type StoreOption = {
  id: string;
  name: string;
  province: string | null;
};

type SaleUnitDetail = {
  unitName: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

type StandardUnit = {
  quantity: number;
  price: number;
  total: number;
};

type StandardizedUnits = {
  box: StandardUnit;
  pack: StandardUnit;
  piece: StandardUnit;
};

type ReportRow = {
  dateIso: string;
  dateLabel: string;
  dayOfWeek: string;
  time: string;
  storeName: string | null;
  productName: string | null;
  productCode: string;
  units: SaleUnitDetail[];
  quantity: number;
  unitPrice?: number;
  total: number;
  assignmentId?: string | null;
  unitId?: string | null;
  isFirstOfDay?: boolean;
  isEmpty?: boolean;
};

type SummaryProduct = {
  name: string;
  quantity: number;
  total: number;
};

type ReportRowWithSummary = ReportRow & {
  isDailySummary?: boolean;
  summaryProducts?: SummaryProduct[];
};

function isSummaryRow(row: ReportRow | ReportRowWithSummary): row is ReportRowWithSummary {
  return Boolean((row as ReportRowWithSummary).isDailySummary);
}

type ReportTotals = {
  quantity: number;
  amount: number;
  amountDisplay: string;
  targetRevenuePC: number | null;
  targetRevenuePCDisplay: string | null;
  achievementPercent: number | null;
};

type UnitTotals = {
  box: { quantity: number; totalPc: number };
  pack: { quantity: number; totalPc: number };
  piece: { quantity: number; totalPc: number };
};

type PaginationInfo = {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
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
    showAllDays?: boolean;
    rangeSummary: string;
    ranges: Array<{
      startIso: string;
      endIso: string;
      label: string;
    }>;
  };
  rows: ReportRow[];
  totals: ReportTotals;
  unitTotals: UnitTotals;
  pagination?: PaginationInfo;
};

type Props = {
  initialEmployees: EmployeeOption[];
  initialStores: StoreOption[];
};

const FALLBACK_LOGO = "/icons/icon-192x192.png";

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

function formatCurrencyTh(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }
  return `฿ ${value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumberTh(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }
  return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function standardizeUnits(units: SaleUnitDetail[]): StandardizedUnits {
  const emptyUnit: StandardUnit = { quantity: 0, price: 0, total: 0 };
  const result: StandardizedUnits = {
    box: { ...emptyUnit },
    pack: { ...emptyUnit },
    piece: { ...emptyUnit },
  };

  units.forEach((unit) => {
    const unitNameLower = unit.unitName.toLowerCase().trim();

    // Map unit names to standard categories and ACCUMULATE quantity and totals
    if (unitNameLower.includes('กล่อง') || unitNameLower.includes('box') || unitNameLower.includes('ลัง')) {
      result.box.quantity += unit.quantity;
      result.box.total += unit.total;
    } else if (unitNameLower.includes('แพ็ค') || unitNameLower.includes('pack') || unitNameLower.includes('แพค')) {
      result.pack.quantity += unit.quantity;
      result.pack.total += unit.total;
    } else if (unitNameLower.includes('ซอง') || unitNameLower.includes('ชิ้น') || unitNameLower.includes('ปี๊บ') || unitNameLower.includes('piece')) {
      result.piece.quantity += unit.quantity;
      result.piece.total += unit.total;
    }
  });

  // Calculate average prices after accumulation
  if (result.box.quantity > 0) {
    result.box.price = result.box.total / result.box.quantity;
  }
  if (result.pack.quantity > 0) {
    result.pack.price = result.pack.total / result.pack.quantity;
  }
  if (result.piece.quantity > 0) {
    result.piece.price = result.piece.total / result.piece.quantity;
  }

  return result;
}


function getGroupByLabel(groupBy: "detail" | "daily" | "monthly" | "quarterly" | "yearly"): string {
  const labels = {
    detail: "รายละเอียด",
    daily: "สรุปรายวัน",
    monthly: "สรุปรายเดือน",
    quarterly: "สรุปไตรมาส",
    yearly: "สรุปรายปี",
  };
  return labels[groupBy];
}


function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getUTCDay();
  const diff = (day + 6) % 7;
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
  storeId: string;
  page: number;
  pageSize: number;
  showAllDays: boolean;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: ReportData }
  | { status: "error"; message: string };

function buildCsv(report: ReportData) {
  const headers = ["วันที่", "ร้านค้า", "สินค้า", "จำนวน", "ยอดเงิน"];
  const rows = report.rows.map((row) => [
    row.dateLabel,
    row.storeName ?? "",
    row.productName ?? "",
    row.quantity.toString(),
    row.total.toFixed(2),
  ]);
  const all = [headers, ...rows];
  const csvContent = all
    .map((cols) =>
      cols
        .map((value) => {
          if (value === null || value === undefined) return "";
          const needsQuote = /[",\n]/.test(value);
          if (!needsQuote) return value;
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");

  // เพิ่ม BOM (Byte Order Mark) เพื่อให้ Excel รู้ว่าเป็น UTF-8
  return "\uFEFF" + csvContent;
}

function buildExcelXml(report: ReportData) {
  const headerRow = `
    <Row>
      <Cell><Data ss:Type="String">วันที่</Data></Cell>
      <Cell><Data ss:Type="String">ร้านค้า</Data></Cell>
      <Cell><Data ss:Type="String">สินค้า</Data></Cell>
      <Cell><Data ss:Type="String">จำนวน</Data></Cell>
      <Cell><Data ss:Type="String">ยอดเงิน</Data></Cell>
    </Row>
  `;

  const dataRows = report.rows
    .map(
      (row) => `
        <Row>
          <Cell><Data ss:Type="String">${row.dateLabel}</Data></Cell>
          <Cell><Data ss:Type="String">${row.storeName ?? ""}</Data></Cell>
          <Cell><Data ss:Type="String">${row.productName ?? ""}</Data></Cell>
          <Cell><Data ss:Type="Number">${row.quantity}</Data></Cell>
          <Cell><Data ss:Type="Number">${row.total.toFixed(2)}</Data></Cell>
        </Row>
      `,
    )
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

export default function SalesReportPageClient({ initialEmployees, initialStores }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read from URL or localStorage (lazy loading)
  const [filters, setFilters] = useState<FiltersState>(() => {
    const urlEmployeeId = searchParams.get("employeeId");
    const urlStoreId = searchParams.get("storeId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const showAllDays = searchParams.get("showAllDays") === "true";

    // If URL has employeeId, use it
    if (urlEmployeeId) {
      return {
        employeeId: urlEmployeeId,
        storeId: urlStoreId || "",
        page,
        pageSize,
        showAllDays,
      };
    }

    // Otherwise, check localStorage (for refresh persistence)
    if (typeof window !== "undefined") {
      const savedEmployeeId = window.localStorage.getItem("sales-report:last-employee-id");
      const savedStoreId = window.localStorage.getItem("sales-report:last-store-id");

      // Validate saved IDs exist in current data
      const isValidEmployee = savedEmployeeId && initialEmployees.some(e => e.id === savedEmployeeId);
      const isValidStore = savedStoreId && initialStores.some(s => s.id === savedStoreId);

      if (isValidEmployee) {
        return {
          employeeId: savedEmployeeId,
          storeId: isValidStore ? savedStoreId : "",
          page,
          pageSize,
          showAllDays,
        };
      }
    }

    // Default: no employee selected (lazy loading)
    return {
      employeeId: "",
      storeId: "",
      page,
      pageSize,
      showAllDays,
    };
  });

  const [groupBy, setGroupBy] = useState<"detail" | "daily" | "monthly" | "quarterly" | "yearly">(() => {
    const param = searchParams.get("groupBy");
    return param === "daily" || param === "monthly" || param === "quarterly" || param === "yearly" ? param : "detail";
  });

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
    const start = startOfMonth(today);
    const end = endOfMonth(today);
    return [createRangeItem(toIsoDate(start), toIsoDate(end))];
  });

  const [draftRange, setDraftRange] = useState<RangeItem>(() => {
    const today = startOfToday();
    const iso = toIsoDate(today);
    return createRangeItem(iso, iso);
  });

  const [state, setState] = useState<FetchState>({ status: "idle" });
  const showDailySummary = false; // Daily summary disabled
  const abortRef = useRef<AbortController | null>(null);
  const reportContainerRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const selectedEmployee = useMemo(
    () => initialEmployees.find((employee) => employee.id === filters.employeeId) ?? null,
    [filters.employeeId, initialEmployees],
  );

  const selectedStore = useMemo(
    () => initialStores.find((store) => store.id === filters.storeId) ?? null,
    [filters.storeId, initialStores],
  );

  // Drag to scroll functionality
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!tableScrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tableScrollRef.current.offsetLeft);
    setScrollLeft(tableScrollRef.current.scrollLeft);
    tableScrollRef.current.style.cursor = 'grabbing';
    tableScrollRef.current.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !tableScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableScrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    tableScrollRef.current.scrollLeft = scrollLeft - walk;
  }, [isDragging, startX, scrollLeft]);

  const handleMouseUpOrLeave = useCallback(() => {
    if (!tableScrollRef.current) return;
    setIsDragging(false);
    tableScrollRef.current.style.cursor = 'grab';
    tableScrollRef.current.style.userSelect = 'auto';
  }, []);

  // Prevent text selection while dragging
  useEffect(() => {
    const handleSelectStart = (e: Event) => {
      if (isDragging) {
        e.preventDefault();
      }
    };
    document.addEventListener('selectstart', handleSelectStart);
    return () => {
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, [isDragging]);

  // Sync filters, ranges, and groupBy to URL
  // Save selected employee/store to localStorage (for refresh persistence)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (filters.employeeId) {
      window.localStorage.setItem("sales-report:last-employee-id", filters.employeeId);
    } else {
      window.localStorage.removeItem("sales-report:last-employee-id");
    }

    if (filters.storeId) {
      window.localStorage.setItem("sales-report:last-store-id", filters.storeId);
    } else {
      window.localStorage.removeItem("sales-report:last-store-id");
    }
  }, [filters.employeeId, filters.storeId]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.employeeId) params.set("employeeId", filters.employeeId);
    if (filters.storeId) params.set("storeId", filters.storeId);
    params.set("page", String(filters.page));
    params.set("pageSize", String(filters.pageSize));
    if (filters.showAllDays) params.set("showAllDays", "true");
    params.set("groupBy", groupBy);

    if (ranges.length > 0) {
      const rangesData = ranges.map(r => ({ start: r.start, end: r.end }));
      params.set("ranges", JSON.stringify(rangesData));
    }

    router.replace(`?${params.toString()}`, { scroll: false });
  }, [filters, ranges, groupBy, router]);

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
    params.set("pageSize", String(filters.pageSize));
    params.set("showAllDays", String(filters.showAllDays));
    params.set("groupBy", groupBy);
    if (filters.storeId) params.set("storeId", filters.storeId);
    ranges.forEach((range) => {
      params.append("range", `${range.start}:${range.end}`);
    });

    setState({ status: "loading" });
    void fetch(`/api/admin/reports/sales?${params.toString()}`, {
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
        const message = error instanceof Error ? error.message : "ไม่สามารถโหลดรายงานได้";
        setState({ status: "error", message });
      });

    return () => {
      controller.abort();
    };
  }, [filters, ranges, groupBy]);

  const handleChange = (key: keyof FiltersState, value: string) => {
    setFilters((prev) => {
      if (key === "page") {
        return { ...prev, page: Number(value) };
      }
      if (key === "pageSize") {
        return { ...prev, pageSize: Number(value), page: 1 };
      }
      if (key === "showAllDays") {
        return { ...prev, showAllDays: value === "true", page: 1 };
      }
      if (key === "employeeId") {
        const employee = initialEmployees.find((item) => item.id === value) ?? null;
        const inferredStoreId = employee?.defaultStoreId &&
          initialStores.some((store) => store.id === employee.defaultStoreId)
            ? employee.defaultStoreId!
            : "";
        return {
          ...prev,
          employeeId: value,
          storeId: inferredStoreId,
          page: 1,
        };
      }
      if (key === "storeId") {
        return { ...prev, storeId: value, page: 1 };
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
    // ไม่ต้อง reset - ค้างค่าเดิมไว้เพื่อให้ผู้ใช้เลือกช่วงต่อไปได้สะดวก
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
    const filename = `sales-report-${state.data.employee.name}-${Date.now()}.csv`;
    downloadBlob(csv, "text/csv;charset=utf-8", filename);
  };

  const handleExportExcel = () => {
    if (state.status !== "success") return;
    const xml = buildExcelXml(state.data);
    const filename = `sales-report-${state.data.employee.name}-${Date.now()}.xls`;
    downloadBlob(xml, "application/vnd.ms-excel", filename);
  };


  const handlePrint = async () => {
    if (state.status !== "success" || !state.data) return;

    // Fetch ALL pages for printing
    const totalPages = state.data.pagination?.totalPages || 1;
    const allRows: ReportRow[] = [];


    try {
      for (let page = 1; page <= totalPages; page++) {
        const params = new URLSearchParams();
        params.set("employeeId", filters.employeeId);
        params.set("page", String(page));
        params.set("pageSize", String(filters.pageSize));
        params.set("showAllDays", String(filters.showAllDays));
        params.set("groupBy", groupBy);
        if (filters.storeId) params.set("storeId", filters.storeId);
        ranges.forEach((range) => {
          params.append("range", `${range.start}:${range.end}`);
        });

        const response = await fetch(`/api/admin/reports/sales?${params.toString()}`);
        if (!response.ok) {
          alert("ไม่สามารถโหลดข้อมูลทั้งหมดสำหรับพิมพ์ได้");
          return;
        }
        const payload = await response.json() as { data: ReportData };
        allRows.push(...payload.data.rows);
      }
    } catch (error) {
      console.error("Failed to fetch all data for printing:", error);
      alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      return;
    }

    // Use all fetched rows with current report data structure
    const reportData: ReportData = {
      ...state.data,
      rows: allRows,
    };

    // Sales report is always for 1 employee, so supervisor signature should be blank
    const supervisorSignatureName = "";
    void supervisorSignatureName;

    // For printing, always use reportData.rows (no daily summary in print)
    const rowsToRender = reportData.rows;

    const logoUrl = getBrandingLogoUrl(reportData.branding.logoPath, reportData.branding.updatedAt, {
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


    const rowsHtml = rowsToRender
      .map((row) => {
        const segments: string[] = [];

        if (isSummaryRow(row)) {
          const summaryProducts = row.summaryProducts ?? [];
          const totalQuantity = summaryProducts.reduce((sum, product) => sum + product.quantity, 0);
          const totalAmountPc = summaryProducts.reduce((sum, product) => sum + product.total, 0);

          const productCards = summaryProducts
            .map((product) => `
              <div class="summary-card">
                <div class="summary-card-title">${product.name}</div>
                <div class="summary-card-metric"><span>จำนวน</span><span>${product.quantity.toLocaleString('th-TH')} ชิ้น</span></div>
                <div class="summary-card-metric"><span>ยอดขาย</span><span>${formatCurrencyTh(product.total)}</span></div>
              </div>
            `)
            .join('');

          segments.push(`
            <tr class="summary-row">
              <td colspan="${groupBy === 'monthly' ? '12' : groupBy === 'daily' ? '13' : '12'}">
                <div class="summary-wrapper">
                  <div class="summary-header">
                    <span class="summary-badge">
                      สรุปยอดขายวันที่ ${row.dateLabel}
                    </span>
                    <div class="summary-totals">
                      <span class="summary-total"><span>ยอดรวม</span><span>${formatCurrencyTh(totalAmountPc)}</span></span>
                      <span class="summary-total"><span>จำนวน</span><span>${totalQuantity.toLocaleString('th-TH')} ชิ้น</span></span>
                    </div>
                  </div>
                  <div class="summary-grid">
                    ${productCards}
                  </div>
                </div>
              </td>
            </tr>
          `);
          return segments.join('');
        }

        if (row.isEmpty) {
          segments.push(`
            <tr>
              <td colspan="${groupBy === 'monthly' ? '1' : groupBy === 'daily' ? '2' : '2'}" class="text-center">ไม่มีข้อมูล</td>
              <td colspan="10" class="text-center">-</td>
            </tr>
          `);
          return segments.join('');
        }

        const units = row.units ?? [];
        const standardized = standardizeUnits(units);

        const formatQty = (qty: number) => qty > 0 ? qty.toLocaleString('th-TH') : '-';
        const formatPrice = (price: number) => price > 0 ? formatNumberTh(price) : '-';
        const formatTotal = (total: number) => total > 0 ? formatNumberTh(total) : '-';

        segments.push(`
          <tr>
            ${groupBy === 'daily' ? `<td class="text-center">${row.dayOfWeek || '-'}</td>` : ''}
            <td class="text-center">${row.dateLabel || '-'}</td>
            ${groupBy === 'detail' ? `<td class="text-center">${row.time || '-'}</td>` : ''}
            <td class="text-left">${row.productName ?? '-'}</td>

            <!-- PC Box -->
            <td class="text-center bg-emerald">${formatQty(standardized.box.quantity)}</td>
            <td class="text-right bg-emerald">${formatPrice(standardized.box.price)}</td>
            <td class="text-right bg-emerald">${formatTotal(standardized.box.total)}</td>

            <!-- PC Pack -->
            <td class="text-center bg-emerald">${formatQty(standardized.pack.quantity)}</td>
            <td class="text-right bg-emerald">${formatPrice(standardized.pack.price)}</td>
            <td class="text-right bg-emerald">${formatTotal(standardized.pack.total)}</td>

            <!-- PC Piece -->
            <td class="text-center bg-emerald">${formatQty(standardized.piece.quantity)}</td>
            <td class="text-right bg-emerald">${formatPrice(standardized.piece.price)}</td>
            <td class="text-right bg-emerald">${formatTotal(standardized.piece.total)}</td>

            <!-- PC Total -->
            <td class="text-right font-bold bg-emerald-dark">${formatCurrencyTh(row.total)}</td>
          </tr>
        `);

        return segments.join('');
      })
      .join('');

    // Calculate unit breakdown for summary
    let totalBoxQty = 0;
    let totalPackQty = 0;
    let totalPieceQty = 0;

    reportData.rows.forEach((row) => {
      if (row.units) {
        row.units.forEach((unit) => {
          const unitNameLower = unit.unitName.toLowerCase().trim();

          // Check unit name to categorize
          if (unitNameLower.includes('กล่อง') || unitNameLower.includes('box') || unitNameLower.includes('ลัง')) {
            totalBoxQty += unit.quantity;
          } else if (unitNameLower.includes('แพ็ค') || unitNameLower.includes('pack') || unitNameLower.includes('แพค')) {
            totalPackQty += unit.quantity;
          } else if (unitNameLower.includes('ปี๊บ') || unitNameLower.includes('ซอง') || unitNameLower.includes('ชิ้น') ||
                     unitNameLower.includes('piece') || unitNameLower.includes('bottle')) {
            totalPieceQty += unit.quantity;
          }
        });
      }
    });

    const unitBreakdownText = `${totalBoxQty} กล่อง | ${totalPackQty} แพ็ค | ${totalPieceQty} ปี๊บ/ซอง`;

    // Use unit totals from API (calculated from all rows, not just current page)
    const unitTotalsForPrint = reportData.unitTotals;

    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>รายงานยอดขาย - ${reportData.employee.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: A4 landscape;
      margin: 8mm;
      @bottom-right {
        content: "หน้า " counter(page) " จาก " counter(pages);
        font-size: 10px;
        color: #666;
      }
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #000;
    }

    .container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      padding: 5mm;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #333;
      gap: 20px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
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
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    }

    .company-logo img[data-loaded="true"] {
      opacity: 1;
    }

    .company-names {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .company-names h1 {
      font-size: 18px;
      font-weight: bold;
      margin: 0;
    }

    .company-names p {
      font-size: 12px;
      color: #333;
      margin: 0;
    }

    .employee-info {
      text-align: right;
      font-size: 12px;
    }

    .date-header-row td {
      padding: 0 !important;
      border: none !important;
      padding-top: 15px !important;
    }

    .date-header-row:first-child td {
      padding-top: 0 !important;
    }

    .date-divider {
      display: inline-block;
      font-weight: 700;
      font-size: 12px;
      color: #1e293b;
      padding: 0;
      margin-bottom: 8px;
    }

    .table-subheader th {
      background: #f8fafc;
      border: 1px solid #000;
      padding: 4px 2px;
      text-align: center;
      font-weight: bold;
      color: #475569;
      font-size: 9px;
      white-space: nowrap;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0;
      page-break-inside: auto;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      border: 1px solid #000;
    }

    thead {
      display: table-header-group;
    }

    tfoot {
      display: table-row-group;
      page-break-inside: avoid;
    }

    tbody tr {
      page-break-inside: avoid;
    }

    th {
      background: #f8fafc;
      border: 1px solid #000;
      padding: 4px 2px;
      text-align: center;
      font-weight: bold;
      color: #475569;
      font-size: 9px;
      white-space: nowrap;
    }

    .bg-emerald-header {
      background: #ecfdf5 !important;
      color: #047857 !important;
    }

    .bg-amber-header {
      background: #fef3c7 !important;
      color: #b45309 !important;
    }

    .bg-emerald-sub {
      background: rgba(236, 253, 245, 0.5) !important;
      color: #059669 !important;
    }

    .bg-amber-sub {
      background: rgba(254, 243, 199, 0.5) !important;
      color: #d97706 !important;
    }

    td {
      border: 1px solid #000;
      padding: 3px 2px;
      text-align: center;
      font-size: 9px;
      white-space: nowrap;
    }

    .bg-emerald {
      background: rgba(236, 253, 245, 0.3) !important;
    }

    .bg-emerald-dark {
      background: #d1fae5 !important;
      color: #047857 !important;
    }

    .bg-amber {
      background: rgba(254, 243, 199, 0.3) !important;
    }

    .bg-amber-dark {
      background: #fde68a !important;
      color: #b45309 !important;
    }

    .text-left {
      text-align: left;
    }

    .text-right {
      text-align: right;
    }

    .summary {
      margin-top: 20px;
      padding: 10px;
      border: 1px solid #333;
      text-align: center;
      font-size: 14px;
    }

    .summary-row td {
      border: 1px solid #000;
      background: #eff6ff;
      padding: 12px;
    }

    .summary-wrapper {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .summary-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .summary-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-radius: 9999px;
      background: linear-gradient(90deg, #2563eb, #1d4ed8);
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
    }

    .summary-totals {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .summary-total {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      border-radius: 9999px;
      border: 1px solid #bfdbfe;
      background: #ffffff;
      color: #1d4ed8;
      font-size: 11px;
      font-weight: 600;
    }

    .summary-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }

    .summary-card {
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 8px;
      background: #ffffff;
    }

    .summary-card-title {
      font-weight: 600;
      font-size: 10px;
      color: #1e293b;
      margin-bottom: 6px;
    }

    .summary-card-metric {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #64748b;
      margin: 4px 0;
    }

    .summary-card-metric span:last-child {
      font-weight: 600;
      color: #0f172a;
    }

    .signatures {
      margin-top: 30px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .signature-row {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      gap: 10px;
      page-break-inside: avoid;
      margin-top: 20px;
    }

    .signature-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex: 1 1 0;
      min-width: 0;
      border: 1px solid #333;
      padding: 28px 8px 12px 8px;
      background: #fafafa;
    }

    .signature-inline {
      display: flex;
      align-items: baseline;
      gap: 5px;
      font-size: 9px;
      white-space: nowrap;
    }

    .signature-line {
      display: inline-block;
      border-bottom: 1px solid #333;
      min-width: 90px;
      width: 90px;
    }

    .signature-name {
      font-size: 10px;
      color: #333;
      margin-top: 2px;
      white-space: nowrap;
      text-align: center;
      min-width: 120px;
    }

    .signature-date {
      font-size: 9px;
      color: #666;
      margin-top: 3px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-left">
        <div class="company-logo">
          <img src="${logoUrl}" alt="Company Logo" onload="this.setAttribute('data-loaded', 'true')" />
        </div>
        <div class="company-names">
          <h1>บริษัทเคพีฟู้ดส์ จำกัด</h1>
          <p>รายงานการขาย${getGroupByLabel(groupBy)} PC ${selectedEmployee?.region ? `เขต ${selectedEmployee.region}` : ""}</p>
          <p>ช่วงรายงาน: ${rangeSummary}</p>
        </div>
      </div>
      <div class="employee-info">
        <p style="text-align: right;">
          <span style="font-weight: 600;">พนักงาน:</span> <span style="color: #0f172a;">${selectedEmployee?.name ?? '-'}</span>
        </p>
        <p style="text-align: right;">
          เบอร์: ${selectedEmployee?.phone ?? '-'}
        </p>
        <p style="text-align: right;">
          ร้านค้า: ${selectedStore?.name ?? 'ทั้งหมด'} | เขต: ${selectedEmployee?.region ?? "-"}
        </p>
        <p style="text-align: right;">
          วันหยุด: ${selectedEmployee?.regularDayOff ?? "-"}
        </p>
        <p style="text-align: right; margin-top: 8px; font-size: 10px; color: #64748b;">
          พิมพ์เอกสารเมื่อ: ${printTimestamp}
        </p>
      </div>
    </header>

    <table>
      <thead>
        <tr class="table-subheader">
          ${groupBy === 'daily' ? '<th rowspan="3">วัน</th>' : ''}
          <th rowspan="3">วันที่</th>
          ${groupBy === 'detail' ? '<th rowspan="3">เวลา</th>' : ''}
          <th rowspan="3">สินค้า</th>
          <th colspan="10" class="bg-emerald-header">ยอดขายร้านค้า (PC)</th>
        </tr>
        <tr class="table-subheader">
          <th colspan="3" class="bg-emerald-sub">กล่อง</th>
          <th colspan="3" class="bg-emerald-sub">แพ็ค</th>
          <th colspan="3" class="bg-emerald-sub">ซอง/ปี๊บ</th>
          <th rowspan="2">รวม<br/>(PC)</th>
        </tr>
        <tr class="table-subheader">
          <th>จำนวน</th><th>ราคา</th><th>รวม</th>
          <th>จำนวน</th><th>ราคา</th><th>รวม</th>
          <th>จำนวน</th><th>ราคา</th><th>รวม</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="${groupBy === 'monthly' || groupBy === 'quarterly' || groupBy === 'yearly' ? '2' : '3'}" style="text-align:center; font-weight:bold;">รวมทั้งหมด</td>
          <!-- PC Box -->
          <td style="text-align:center;" class="bg-emerald">${unitTotalsForPrint.box.quantity > 0 ? unitTotalsForPrint.box.quantity.toLocaleString('th-TH') : '-'}</td>
          <td style="text-align:right;" class="bg-emerald">-</td>
          <td style="text-align:right;" class="bg-emerald">${unitTotalsForPrint.box.totalPc > 0 ? formatNumberTh(unitTotalsForPrint.box.totalPc) : '-'}</td>
          <!-- PC Pack -->
          <td style="text-align:center;" class="bg-emerald">${unitTotalsForPrint.pack.quantity > 0 ? unitTotalsForPrint.pack.quantity.toLocaleString('th-TH') : '-'}</td>
          <td style="text-align:right;" class="bg-emerald">-</td>
          <td style="text-align:right;" class="bg-emerald">${unitTotalsForPrint.pack.totalPc > 0 ? formatNumberTh(unitTotalsForPrint.pack.totalPc) : '-'}</td>
          <!-- PC Piece -->
          <td style="text-align:center;" class="bg-emerald">${unitTotalsForPrint.piece.quantity > 0 ? unitTotalsForPrint.piece.quantity.toLocaleString('th-TH') : '-'}</td>
          <td style="text-align:right;" class="bg-emerald">-</td>
          <td style="text-align:right;" class="bg-emerald">${unitTotalsForPrint.piece.totalPc > 0 ? formatNumberTh(unitTotalsForPrint.piece.totalPc) : '-'}</td>
          <!-- PC Total -->
          <td style="text-align:right; font-weight:bold;" class="bg-emerald-dark">${formatCurrencyTh(reportData.totals.amount)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="summary">
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
        <span style="white-space: nowrap;">
          <strong>ยอดขายรวมทั้งหมด:</strong> ${formatCurrencyTh(reportData.totals.amount)}
        </span>
        ${reportData.totals.targetRevenuePCDisplay ? `
        <span style="height: 20px; width: 1px; background-color: #cbd5e1;"></span>
        <span style="white-space: nowrap;">
          <strong>เป้าหมาย:</strong> <span style="color: #2563eb;">${reportData.totals.targetRevenuePCDisplay}</span>
        </span>
        ` : ''}
        ${reportData.totals.achievementPercent !== null ? `
        <span style="height: 20px; width: 1px; background-color: #cbd5e1;"></span>
        <span style="white-space: nowrap;">
          <strong>บรรลุเป้า:</strong> <span style="color: ${reportData.totals.achievementPercent >= 100 ? '#16a34a' : '#ea580c'};">${reportData.totals.achievementPercent.toFixed(1)}%</span>
        </span>
        ` : ''}
        <span style="height: 20px; width: 1px; background-color: #cbd5e1;"></span>
        <span style="white-space: nowrap;">
          <strong>จำนวนสินค้า:</strong> ${unitBreakdownText}
        </span>
      </div>
    </div>

    <div class="signatures">
      <div class="signature-row">
        <!-- 1. พนักงาน -->
        <div class="signature-cell">
          <div class="signature-inline">
            <span>ลงชื่อ</span>
            <span class="signature-line"></span>
            <span>พนักงาน</span>
          </div>
          <span class="signature-name">(${reportData.employee.name})</span>
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
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };


  const hasEmployees = initialEmployees.length > 0;

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

  const totalAmountDisplay = report?.totals.amountDisplay ?? "฿ 0.00";
  // Removed: totalCompanyAmount, overallDifference, overallPercent - no longer displayed

  // Calculate unit breakdown for display
  const unitBreakdown = useMemo(() => {
    if (!report?.rows) return { box: 0, pack: 0, piece: 0 };

    let totalBoxQty = 0;
    let totalPackQty = 0;
    let totalPieceQty = 0;

    report.rows.forEach((row) => {
      if (row.units) {
        row.units.forEach((unit) => {
          const unitNameLower = unit.unitName.toLowerCase().trim();

          if (unitNameLower.includes('กล่อง') || unitNameLower.includes('box') || unitNameLower.includes('ลัง')) {
            totalBoxQty += unit.quantity;
          } else if (unitNameLower.includes('แพ็ค') || unitNameLower.includes('pack') || unitNameLower.includes('แพค')) {
            totalPackQty += unit.quantity;
          } else if (unitNameLower.includes('ปี๊บ') || unitNameLower.includes('ซอง') || unitNameLower.includes('ชิ้น') ||
                     unitNameLower.includes('piece') || unitNameLower.includes('bottle')) {
            totalPieceQty += unit.quantity;
          }
        });
      }
    });

    return { box: totalBoxQty, pack: totalPackQty, piece: totalPieceQty };
  }, [report?.rows]);

  const unitBreakdownText = `${unitBreakdown.box} กล่อง | ${unitBreakdown.pack} แพ็ค | ${unitBreakdown.piece} ปี๊บ/ซอง`;

  // Use unit totals from API (calculated from all rows, not just current page)
  const unitTotals = report?.unitTotals ?? {
    box: { quantity: 0, totalPc: 0 },
    pack: { quantity: 0, totalPc: 0 },
    piece: { quantity: 0, totalPc: 0 },
  };

  // Calculate rows with daily summary inserted
  const rowsWithSummary = useMemo<ReportRowWithSummary[]>(() => {
    if (!report) return [];

    if (!showDailySummary) return report.rows;

    const result: ReportRowWithSummary[] = [];
    const summaryByDay = new Map<string, Map<string, { quantity: number; total: number }>>();

    // First pass: calculate summaries
    report.rows.forEach((row) => {
      if (row.isEmpty || !row.productName) return;

      if (!summaryByDay.has(row.dateIso)) {
        summaryByDay.set(row.dateIso, new Map());
      }

      const daySummary = summaryByDay.get(row.dateIso)!;
      const existing = daySummary.get(row.productName) ?? { quantity: 0, total: 0 };

      daySummary.set(row.productName, {
        quantity: existing.quantity + row.quantity,
        total: existing.total + row.total,
      });
    });

    // Second pass: insert rows with summaries
    report.rows.forEach((row, index) => {
      result.push(row);

      // Check if we need to insert summary after this day
      const nextRow = report.rows[index + 1];
      const isLastRowOfDay = !nextRow || nextRow.dateIso !== row.dateIso;

      if (isLastRowOfDay && summaryByDay.has(row.dateIso)) {
        const daySummary = summaryByDay.get(row.dateIso)!;
        const summaryProducts: SummaryProduct[] = Array.from(daySummary.entries()).map(([name, data]) => ({
          name,
          quantity: data.quantity,
          total: data.total,
        }));

        // Add summary row
        const summaryRow: ReportRowWithSummary = {
          dateIso: row.dateIso,
          dateLabel: row.dateLabel,
          dayOfWeek: "",
          time: "",
          storeName: null,
          productName: null,
          productCode: "",
          units: [],
          quantity: 0,
          unitPrice: 0,
          total: 0,
          isDailySummary: true,
          summaryProducts,
        };
        result.push(summaryRow);
      }
    });

    return result;
  }, [report, showDailySummary]);

  if (!hasEmployees) {
    return (
      <div className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900 -mt-4 mb-2">รายงานยอดขาย</h1>
          <p className="text-sm text-slate-500">กรุณาเพิ่มรายชื่อพนักงานก่อน เพื่อสร้างรายงานยอดขาย</p>
        </header>
        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 px-5 py-4 text-sm text-amber-700 shadow-inner">
          ยังไม่มีข้อมูลพนักงาน
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      <header className="space-y-3 print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900 -mt-4 mb-2">รายงานยอดขายพนักงาน</h1>
        <p className="text-sm text-slate-500">สรุปยอดขายตามพนักงาน/ร้านค้า พร้อมรายละเอียดสินค้าและยอดเงิน</p>
      </header>

      <section className="print:hidden rounded-3xl border border-blue-100 bg-white/90 p-3 sm:p-5 shadow-[0_30px_120px_-110px_rgba(37,99,235,0.8)]">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">พนักงาน *</label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
              value={filters.employeeId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => handleChange("employeeId", event.target.value)}
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

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">ร้านค้า</label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
              value={filters.storeId}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => handleChange("storeId", event.target.value)}
              disabled={toolbarDisabled}
            >
              <option value="">ทั้งหมด</option>
              {initialStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
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
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-blue-600 px-4 py-2 text-xs font-semibold !text-white shadow-[0_12px_35px_-30px_rgba(37,99,235,0.85)] transition disabled:cursor-not-allowed disabled:opacity-60"
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

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">จำนวนรายการต่อหน้า</label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
              value={filters.pageSize}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => handleChange("pageSize", event.target.value)}
              disabled={toolbarDisabled}
            >
              {[10, 20, 30, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} รายการ
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">ตัวเลือกการแสดงผล</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showAllDays"
                checked={filters.showAllDays}
                onChange={(event) => handleChange("showAllDays", event.target.checked ? "true" : "false")}
                disabled={toolbarDisabled}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <label htmlFor="showAllDays" className="text-sm text-slate-700">
                แสดงวันที่ทุกวัน (รวมวันที่ไม่มียอดขาย)
              </label>
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600">รูปแบบการจัดกลุ่มข้อมูล</label>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="groupBy"
                  value="detail"
                  checked={groupBy === "detail"}
                  onChange={(e) => setGroupBy(e.target.value as "detail")}
                  disabled={toolbarDisabled}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-slate-700">รายละเอียด (แยกตามเวลา)</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="groupBy"
                  value="daily"
                  checked={groupBy === "daily"}
                  onChange={(e) => setGroupBy(e.target.value as "daily")}
                  disabled={toolbarDisabled}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-slate-700">สรุปรายวัน</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="groupBy"
                  value="monthly"
                  checked={groupBy === "monthly"}
                  onChange={(e) => setGroupBy(e.target.value as "monthly")}
                  disabled={toolbarDisabled}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-slate-700">สรุปรายเดือน</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="groupBy"
                  value="quarterly"
                  checked={groupBy === "quarterly"}
                  onChange={(e) => setGroupBy(e.target.value as "quarterly")}
                  disabled={toolbarDisabled}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-slate-700">สรุปไตรมาส</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="groupBy"
                  value="yearly"
                  checked={groupBy === "yearly"}
                  onChange={(e) => setGroupBy(e.target.value as "yearly")}
                  disabled={toolbarDisabled}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-slate-700">สรุปปี</span>
              </label>
            </div>
          </div>

        </form>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePrint}
            disabled={state.status !== "success"}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_60px_-35px_rgba(49,46,129,0.8)] transition disabled:cursor-not-allowed disabled:opacity-60"
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
        {state.status === "success" && state.data.pagination && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">
                แสดง {((state.data.pagination.page - 1) * state.data.pagination.pageSize) + 1} - {
                  Math.min(state.data.pagination.page * state.data.pagination.pageSize, state.data.pagination.totalRows)
                } จาก {state.data.pagination.totalRows} รายการ
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(state.data.pagination!.page - 1)}
                disabled={!state.data.pagination.hasPrevPage}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ก่อนหน้า
              </button>
              <span className="px-3 text-sm text-slate-600">
                หน้า {state.data.pagination.page} จาก {state.data.pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(state.data.pagination!.page + 1)}
                disabled={!state.data.pagination.hasNextPage}
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ถัดไป
              </button>
              <select
                className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900"
                value={state.data.pagination.pageSize}
                onChange={(e) => handleChange("pageSize", e.target.value)}
                disabled={false}
              >
                <option value="10">10 รายการ</option>
                <option value="20">20 รายการ</option>
                <option value="30">30 รายการ</option>
                <option value="50">50 รายการ</option>
                <option value="100">100 รายการ</option>
              </select>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="print:hidden text-sm text-slate-500">
          แสดงผลสำหรับ:{" "}
          <span className="font-medium text-slate-700">{selectedEmployee?.name ?? "-"}</span>{" "}
          · {rangeSummary}
        </div>

        <div
          ref={reportContainerRef}
          id="report-print-container"
          className="w-full border border-slate-200 bg-[#fdfdfc] p-6 shadow-[0_40px_140px_-100px_rgba(37,99,235,0.85)] print:border-none print:bg-white print:p-0 print:shadow-none print:w-[297mm]"
        >
          <div className="box-border flex w-full flex-col gap-4 rounded-[22px] bg-white p-6 shadow-[0_0_1px_rgba(15,23,42,0.08)] print:rounded-none print:p-[10mm] print:shadow-none">
            <header className="flex flex-col md:flex-row md:items-start md:justify-between border-b-2 border-slate-300 pb-3 mb-4">
              <div className="flex items-start gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2">
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
                <div className="space-y-1 flex-1">
                  <p className="text-lg font-bold text-slate-900">
                    บริษัทเคพีฟู้ดส์ จำกัด
                  </p>
                  <p className="text-xs text-slate-700">
                    รายงานการขาย{getGroupByLabel(groupBy)} PC {selectedEmployee?.region ? `เขต ${selectedEmployee.region}` : ""}
                  </p>

                  {/* Mobile: แสดงข้อมูลพนักงานระหว่างชื่อรายงานกับช่วงรายงาน */}
                  <div className="md:hidden space-y-0.5 text-xs text-slate-700 pt-2 pb-1 border-t border-slate-200 mt-2">
                    <p>
                      <span className="font-semibold">พนักงาน:</span>{" "}
                      <span className="text-slate-900">{selectedEmployee?.name ?? "-"}</span>
                    </p>
                    <p>เบอร์: {selectedEmployee?.phone ?? "-"}</p>
                    <p>
                      ร้านค้า: {selectedStore?.name ?? "ทั้งหมด"} | เขต: {selectedEmployee?.region ?? "-"}
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 pt-1">
                    ช่วงรายงาน: {rangeSummary}
                  </p>

                  {/* Target Information */}
                  {report && (report.totals.targetRevenuePCDisplay || report.totals.achievementPercent !== null) && (
                    <div className="text-xs pt-2 space-y-0.5 border-t border-slate-200 mt-2">
                      {report.totals.targetRevenuePCDisplay && (
                        <p className="text-slate-700">
                          <span className="font-semibold">เป้าหมาย:</span>{" "}
                          <span className="text-blue-600 font-semibold">{report.totals.targetRevenuePCDisplay}</span>
                        </p>
                      )}
                      {report.totals.achievementPercent !== null && (
                        <p className="text-slate-700">
                          <span className="font-semibold">บรรลุเป้า:</span>{" "}
                          <span className={`font-semibold ${report.totals.achievementPercent >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                            {report.totals.achievementPercent.toFixed(1)}%
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Desktop: แสดงข้อมูลพนักงานด้านขวา */}
              <div className="hidden md:block text-right text-xs text-slate-700 space-y-0.5">
                <p>
                  <span className="font-semibold">พนักงาน:</span>{" "}
                  <span className="text-slate-900">{selectedEmployee?.name ?? "-"}</span>
                </p>
                <p>เบอร์: {selectedEmployee?.phone ?? "-"}</p>
                <p>
                  ร้านค้า: {selectedStore?.name ?? "ทั้งหมด"} | เขต: {selectedEmployee?.region ?? "-"}
                </p>

                {/* Target Information */}
                {report && (report.totals.targetRevenuePCDisplay || report.totals.achievementPercent !== null) && (
                  <div className="pt-2 space-y-0.5 border-t border-slate-200 mt-2">
                    {report.totals.targetRevenuePCDisplay && (
                      <p>
                        <span className="font-semibold">เป้าหมาย:</span>{" "}
                        <span className="text-blue-600 font-semibold">{report.totals.targetRevenuePCDisplay}</span>
                      </p>
                    )}
                    {report.totals.achievementPercent !== null && (
                      <p>
                        <span className="font-semibold">บรรลุเป้า:</span>{" "}
                        <span className={`font-semibold ${report.totals.achievementPercent >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                          {report.totals.achievementPercent.toFixed(1)}%
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </header>

            {/* Table view - full width on desktop, horizontal scroll on mobile */}
            {report && (
              <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 shadow-lg">
                <div
                  ref={tableScrollRef}
                  className="overflow-x-auto -webkit-overflow-scrolling-touch scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
                  style={{ cursor: 'grab' }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUpOrLeave}
                  onMouseLeave={handleMouseUpOrLeave}
                >
                  <table className="w-full border-collapse text-[11px] sm:text-[12px] lg:text-[13px]">
                    <thead>
                      {/* Top Level Headers */}
                      <tr className="bg-slate-50">
                        {groupBy === "daily" && (
                          <th rowSpan={3} className="border border-slate-200 px-1 py-2 text-center text-slate-700 font-bold text-[12px] md:sticky left-0 md:z-20 bg-slate-50 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}>วัน</th>
                        )}
                        <th rowSpan={3} className="border border-slate-200 px-1 py-2 text-center text-slate-700 font-bold text-[12px] md:sticky md:z-20 bg-slate-50 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" style={{ left: groupBy === "daily" ? '80px' : '0', width: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : '100px', minWidth: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : '100px', maxWidth: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : '100px' }}>วันที่</th>
                        {groupBy === "detail" && (
                          <th rowSpan={3} className="border border-slate-200 px-1 py-2 text-center text-slate-700 font-bold text-[12px] md:sticky md:z-20 bg-slate-50 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" style={{ left: '100px', width: '80px', minWidth: '80px', maxWidth: '80px' }}>เวลา</th>
                        )}
                        <th rowSpan={3} className="border border-slate-200 px-2 py-2 text-center text-slate-700 font-bold text-[12px] md:sticky md:z-20 bg-slate-50 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" style={{ left: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : groupBy === "monthly" ? '100px' : groupBy === "daily" ? '180px' : '180px', width: '180px', minWidth: '180px', maxWidth: '180px' }}>สินค้า</th>
                        <th colSpan={10} className="border border-slate-200 px-1 py-2 text-center text-emerald-700 font-bold text-[12px] bg-emerald-50">ยอดขายร้านค้า (PC)</th>
                      </tr>
                      {/* Second Level Headers - Unit Types */}
                      <tr className="bg-slate-50">
                        {/* PC Section */}
                        <th colSpan={3} className="border border-slate-200 px-1 py-1 text-center text-emerald-700 font-semibold text-[9px] bg-emerald-50/50">กล่อง</th>
                        <th colSpan={3} className="border border-slate-200 px-1 py-1 text-center text-emerald-700 font-semibold text-[9px] bg-emerald-50/50">แพ็ค</th>
                        <th colSpan={3} className="border border-slate-200 px-1 py-1 text-center text-emerald-700 font-semibold text-[9px] bg-emerald-50/50">ซอง/ปี๊บ</th>
                        <th rowSpan={2} className="border border-slate-200 px-1 py-1 text-center text-emerald-700 font-semibold text-[9px] bg-emerald-100">รวม<br/>(PC)</th>
                      </tr>
                      {/* Third Level Headers - Details */}
                      <tr className="bg-slate-50 text-[8px]">
                        {/* PC - Box */}
                        <th className="border border-slate-200 px-0.5 py-1 text-center text-emerald-600 font-medium">จำนวน</th>
                        <th className="border border-slate-200 px-0.5 py-1 text-center text-emerald-600 font-medium">ราคา</th>
                        <th className="border border-slate-200 px-0.5 py-1 text-center text-emerald-600 font-medium">รวม</th>
                        {/* PC - Pack */}
                        <th className="border border-slate-200 px-0.5 py-1 text-center text-emerald-600 font-medium">จำนวน</th>
                        <th className="border border-slate-200 px-0.5 py-1 text-center text-emerald-600 font-medium">ราคา</th>
                        <th className="border border-slate-200 px-0.5 py-1 text-center text-emerald-600 font-medium">รวม</th>
                        {/* PC - Piece */}
                        <th className="border border-slate-200 px-0.5 py-1 text-center text-emerald-600 font-medium">จำนวน</th>
                        <th className="border border-slate-200 px-0.5 py-1 text-center text-emerald-600 font-medium">ราคา</th>
                        <th className="border border-slate-200 px-0.5 py-1 text-center text-emerald-600 font-medium">รวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsWithSummary.map((row, index) => {
                        if (row.isDailySummary) {

                          const summaryProducts = row.summaryProducts ?? [];
                          const totalQuantity = summaryProducts.reduce((sum, product) => sum + product.quantity, 0);
                          const totalAmount = summaryProducts.reduce((sum, product) => sum + product.total, 0);

                          return (
                            <tr key={`summary-${row.dateIso}`} className="bg-blue-50/60">
                              <td colSpan={25} className="border-x border-b border-blue-100 px-4 py-4">
                                <div className="flex flex-col gap-4">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        className="h-4 w-4"
                                      >
                                        <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1z" />
                                        <path d="M18 9H2v7a2 2 0 002 2h12a2 2 0 002-2V9z" />
                                      </svg>
                                      สรุปยอดขายวันที่ {row.dateLabel}
                                    </span>
                                    <div className="flex flex-wrap gap-2 text-xs text-blue-900">
                                      <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 font-semibold shadow-sm">
                                        <span>ยอดรวม</span>
                                        <span className="text-blue-700">{formatCurrencyTh(totalAmount)}</span>
                                      </span>
                                      <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 font-semibold shadow-sm">
                                        <span>จำนวน</span>
                                        <span className="text-blue-700">{totalQuantity.toLocaleString("th-TH")} ชิ้น</span>
                                      </span>
                                    </div>
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {summaryProducts.map((product) => (
                                      <div
                                        key={product.name}
                                        className="flex flex-col gap-2 rounded-2xl border border-blue-200 bg-white/90 px-4 py-3 shadow-sm"
                                      >
                                        <span className="text-sm font-semibold text-slate-800">{product.name}</span>
                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                          <span>จำนวน</span>
                                          <span className="font-semibold text-slate-900">{product.quantity.toLocaleString("th-TH")} ชิ้น</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                          <span>ยอดขาย</span>
                                          <span className="font-semibold text-slate-900">{formatCurrencyTh(product.total)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        // Regular data row - new 24-column structure
                        if (row.isEmpty) {
                          return (
                            <tr key={index} className="text-[11px] md:text-[12px] text-slate-400">
                              <td className="border border-slate-200 px-1 py-2 text-center md:sticky left-0 md:z-10 bg-white md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" colSpan={groupBy === "monthly" || groupBy === "quarterly" || groupBy === "yearly" ? 1 : groupBy === "daily" ? 2 : 2} style={{ width: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : groupBy === "monthly" ? '100px' : groupBy === "daily" ? '180px' : '180px', minWidth: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : groupBy === "monthly" ? '100px' : groupBy === "daily" ? '180px' : '180px', maxWidth: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : groupBy === "monthly" ? '100px' : groupBy === "daily" ? '180px' : '180px' }}>
                                ไม่มีข้อมูล
                              </td>
                              <td className="border border-slate-200 px-1 py-2 text-center" colSpan={22}>
                                -
                              </td>
                            </tr>
                          );
                        }

                        const units = row.units ?? [];
                        const standardized = standardizeUnits(units);

                        const formatQty = (qty: number) => qty > 0 ? qty.toLocaleString('th-TH') : '-';
                        const formatPrice = (price: number) => price > 0 ? formatNumberTh(price) : '-';
                        const formatTotal = (total: number) => total > 0 ? formatNumberTh(total) : '-';

                        return (
                          <tr key={index} className="text-[9px] text-slate-700 group hover:bg-slate-50/50">
                            {/* Day of Week */}
                            {groupBy === "daily" && (
                              <td className="border border-slate-200 px-0.5 py-1.5 text-center whitespace-nowrap md:sticky left-0 md:z-10 bg-white group-hover:bg-slate-50/50 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}>
                                {row.dayOfWeek || '-'}
                              </td>
                            )}
                            {/* Date */}
                            <td className="border border-slate-200 px-0.5 py-1.5 text-center whitespace-nowrap md:sticky md:z-10 bg-white group-hover:bg-slate-50/50 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" style={{ left: groupBy === "daily" ? '80px' : '0', width: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : '100px', minWidth: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : '100px', maxWidth: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : '100px' }}>
                              {row.dateLabel || '-'}
                            </td>
                            {/* Time */}
                            {groupBy === "detail" && (
                              <td className="border border-slate-200 px-0.5 py-1.5 text-center whitespace-nowrap md:sticky md:z-10 bg-white group-hover:bg-slate-50/50 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" style={{ left: '100px', width: '80px', minWidth: '80px', maxWidth: '80px' }}>
                                {row.time || '-'}
                              </td>
                            )}
                            {/* Product */}
                            <td className="border border-slate-200 px-1 py-1.5 text-left font-medium text-slate-900 md:sticky md:z-10 bg-white group-hover:bg-slate-50/50 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" style={{ left: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : groupBy === "monthly" ? '100px' : groupBy === "daily" ? '180px' : '180px', width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                              {row.productName || '-'}
                            </td>

                            {/* PC Section - Box */}
                            <td className="border border-slate-200 px-0.5 py-1.5 text-center bg-emerald-50/30">{formatQty(standardized.box.quantity)}</td>
                            <td className="border border-slate-200 px-0.5 py-1.5 text-right bg-emerald-50/30">{formatPrice(standardized.box.price)}</td>
                            <td className="border border-slate-200 px-0.5 py-1.5 text-right bg-emerald-50/30 font-semibold">{formatTotal(standardized.box.total)}</td>

                            {/* PC Section - Pack */}
                            <td className="border border-slate-200 px-0.5 py-1.5 text-center bg-emerald-50/30">{formatQty(standardized.pack.quantity)}</td>
                            <td className="border border-slate-200 px-0.5 py-1.5 text-right bg-emerald-50/30">{formatPrice(standardized.pack.price)}</td>
                            <td className="border border-slate-200 px-0.5 py-1.5 text-right bg-emerald-50/30 font-semibold">{formatTotal(standardized.pack.total)}</td>

                            {/* PC Section - Piece */}
                            <td className="border border-slate-200 px-0.5 py-1.5 text-center bg-emerald-50/30">{formatQty(standardized.piece.quantity)}</td>
                            <td className="border border-slate-200 px-0.5 py-1.5 text-right bg-emerald-50/30">{formatPrice(standardized.piece.price)}</td>
                            <td className="border border-slate-200 px-0.5 py-1.5 text-right bg-emerald-50/30 font-semibold">{formatTotal(standardized.piece.total)}</td>

                            {/* PC Total */}
                            <td className="border border-slate-200 px-1 py-1.5 text-right font-bold text-emerald-700 bg-emerald-100/50">
                              {formatCurrencyTh(row.total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {(!report.pagination || report.pagination.page === report.pagination.totalPages) && (
                    <tfoot>
                      <tr className="bg-gradient-to-r from-slate-100 to-slate-50 text-[9px] font-bold text-slate-900">
                        <td className="border border-slate-300 px-1 py-2 text-center md:sticky left-0 md:z-10 bg-gradient-to-r from-slate-100 to-slate-50 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" colSpan={groupBy === "monthly" || groupBy === "quarterly" || groupBy === "yearly" ? 2 : 3} style={{ width: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : groupBy === "monthly" ? '100px' : groupBy === "daily" ? '180px' : '180px', minWidth: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : groupBy === "monthly" ? '100px' : groupBy === "daily" ? '180px' : '180px', maxWidth: groupBy === "quarterly" || groupBy === "yearly" ? '120px' : groupBy === "monthly" ? '100px' : groupBy === "daily" ? '180px' : '180px' }}>รวมทั้งหมด</td>
                        {/* PC Box */}
                        <td className="border border-slate-300 px-0.5 py-2 text-center bg-emerald-50">{unitTotals.box.quantity > 0 ? unitTotals.box.quantity.toLocaleString('th-TH') : '-'}</td>
                        <td className="border border-slate-300 px-0.5 py-2 text-right bg-emerald-50">-</td>
                        <td className="border border-slate-300 px-0.5 py-2 text-right bg-emerald-50">{unitTotals.box.totalPc > 0 ? formatNumberTh(unitTotals.box.totalPc) : '-'}</td>
                        {/* PC Pack */}
                        <td className="border border-slate-300 px-0.5 py-2 text-center bg-emerald-50">{unitTotals.pack.quantity > 0 ? unitTotals.pack.quantity.toLocaleString('th-TH') : '-'}</td>
                        <td className="border border-slate-300 px-0.5 py-2 text-right bg-emerald-50">-</td>
                        <td className="border border-slate-300 px-0.5 py-2 text-right bg-emerald-50">{unitTotals.pack.totalPc > 0 ? formatNumberTh(unitTotals.pack.totalPc) : '-'}</td>
                        {/* PC Piece */}
                        <td className="border border-slate-300 px-0.5 py-2 text-center bg-emerald-50">{unitTotals.piece.quantity > 0 ? unitTotals.piece.quantity.toLocaleString('th-TH') : '-'}</td>
                        <td className="border border-slate-300 px-0.5 py-2 text-right bg-emerald-50">-</td>
                        <td className="border border-slate-300 px-0.5 py-2 text-right bg-emerald-50">{unitTotals.piece.totalPc > 0 ? formatNumberTh(unitTotals.piece.totalPc) : '-'}</td>
                        {/* PC Total */}
                        <td className="border border-slate-300 px-1 py-2 text-right bg-emerald-100 text-emerald-800">
                          {totalAmountDisplay}
                        </td>
                      </tr>
                    </tfoot>
                    )}
                 </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {rowsWithSummary.map((row, index) => {
                  // Skip empty rows
                  if (row.isEmpty) return null;

                  // Handle daily summary rows
                  if (row.isDailySummary) {
                    const summaryProducts = row.summaryProducts ?? [];
                    const totalQuantity = summaryProducts.reduce((sum, product) => sum + product.quantity, 0);
                    const totalAmount = summaryProducts.reduce((sum, product) => sum + product.total, 0);

                    return (
                      <div key={`summary-${row.dateIso}`} className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 px-3 py-1.5 text-xs font-semibold text-white">
                            สรุปวันที่ {row.dateLabel}
                          </span>
                        </div>
                        <div className="space-y-2 mb-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700">ยอดรวม:</span>
                            <span className="font-bold text-blue-900">{formatCurrencyTh(totalAmount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-700">จำนวน:</span>
                            <span className="font-semibold text-blue-900">{totalQuantity.toLocaleString("th-TH")} ชิ้น</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {summaryProducts.map((product) => (
                            <div
                              key={product.name}
                              className="rounded-xl border border-blue-200 bg-white px-3 py-2"
                            >
                              <span className="text-sm font-semibold text-slate-800 block mb-1">{product.name}</span>
                              <div className="flex justify-between text-xs text-slate-600">
                                <span>{product.quantity.toLocaleString("th-TH")} ชิ้น</span>
                                <span className="font-semibold text-slate-900">{formatCurrencyTh(product.total)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  // Regular data row - display as card
                  const units = row.units ?? [];
                  const standardized = standardizeUnits(units);

                  return (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                      {/* Header with Date and Total */}
                      <div className="mb-3 flex items-start justify-between border-b border-slate-100 pb-3">
                        <div>
                          {groupBy === "daily" && row.dayOfWeek && (
                            <div className="text-xs text-slate-500">{row.dayOfWeek}</div>
                          )}
                          <div className="font-semibold text-slate-900">{row.dateLabel}</div>
                          {groupBy === "detail" && row.time && (
                            <div className="text-xs text-slate-500">{row.time}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">ยอดรวม</div>
                          <div className="text-lg font-bold text-emerald-700">{formatCurrencyTh(row.total)}</div>
                        </div>
                      </div>

                      {/* Product Name */}
                      <div className="mb-3">
                        <div className="text-xs text-slate-500">สินค้า</div>
                        <div className="font-semibold text-slate-900">{row.productName || '-'}</div>
                      </div>

                      {/* Units Details */}
                      <div className="space-y-3">
                        {/* Box Section */}
                        {standardized.box.quantity > 0 && (
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
                            <div className="mb-2 text-xs font-semibold text-emerald-700">กล่อง</div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <div className="text-xs text-slate-500">จำนวน</div>
                                <div className="font-semibold text-slate-900">{standardized.box.quantity.toLocaleString('th-TH')}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">ราคา</div>
                                <div className="font-medium text-slate-700">{formatNumberTh(standardized.box.price)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-slate-500">รวม</div>
                                <div className="font-bold text-emerald-700">{formatNumberTh(standardized.box.total)}</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Pack Section */}
                        {standardized.pack.quantity > 0 && (
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
                            <div className="mb-2 text-xs font-semibold text-emerald-700">แพ็ค</div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <div className="text-xs text-slate-500">จำนวน</div>
                                <div className="font-semibold text-slate-900">{standardized.pack.quantity.toLocaleString('th-TH')}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">ราคา</div>
                                <div className="font-medium text-slate-700">{formatNumberTh(standardized.pack.price)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-slate-500">รวม</div>
                                <div className="font-bold text-emerald-700">{formatNumberTh(standardized.pack.total)}</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Piece Section */}
                        {standardized.piece.quantity > 0 && (
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
                            <div className="mb-2 text-xs font-semibold text-emerald-700">ซอง/ปี๊บ</div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <div className="text-xs text-slate-500">จำนวน</div>
                                <div className="font-semibold text-slate-900">{standardized.piece.quantity.toLocaleString('th-TH')}</div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">ราคา</div>
                                <div className="font-medium text-slate-700">{formatNumberTh(standardized.piece.price)}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-slate-500">รวม</div>
                                <div className="font-bold text-emerald-700">{formatNumberTh(standardized.piece.total)}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 text-sm text-slate-700 print:hidden">
                <div className="flex flex-col md:flex-row md:items-center md:justify-center gap-2 md:gap-3 rounded-md border border-slate-300 px-4 py-3 md:py-2 text-left md:text-center">
                  <span className="whitespace-nowrap">
                    ยอดขายรวมทั้งหมด <span className="font-semibold text-slate-900">{totalAmountDisplay}</span>
                  </span>
                  {report.totals.targetRevenuePCDisplay && (
                    <>
                      <span className="hidden md:block min-h-[16px] w-px bg-slate-300" />
                      <span className="whitespace-nowrap">
                        เป้าหมาย <span className="font-semibold text-blue-600">{report.totals.targetRevenuePCDisplay}</span>
                      </span>
                    </>
                  )}
                  {report.totals.achievementPercent !== null && (
                    <>
                      <span className="hidden md:block min-h-[16px] w-px bg-slate-300" />
                      <span className="whitespace-nowrap">
                        บรรลุเป้า <span className={`font-semibold ${report.totals.achievementPercent >= 100 ? 'text-green-600' : 'text-orange-600'}`}>{report.totals.achievementPercent.toFixed(1)}%</span>
                      </span>
                    </>
                  )}
                  <span className="hidden md:block min-h-[16px] w-px bg-slate-300" />
                  <span className="whitespace-nowrap">
                    จำนวนสินค้า <span className="font-semibold text-slate-900">{unitBreakdownText}</span>
                  </span>
                </div>
              </div>
              </>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}


