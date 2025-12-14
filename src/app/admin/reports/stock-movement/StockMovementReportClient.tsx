"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { stringify } from "csv-stringify/sync";
import { PackagePlus, ShoppingCart, PackageMinus, Package, User, Search, Calendar } from "lucide-react";

type EmployeeOption = {
  id: string;
  name: string;
};

type StoreOption = {
  id: string;
  name: string;
};

type ProductOption = {
  id: string;
  code: string;
  name: string;
};

type UnitOption = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
};

type TransactionType = "receive" | "sale" | "return" | "adjustment" | "all";

type Transaction = {
  id: string;
  employee_id: string;
  employee_name: string;
  store_id: string;
  store_name: string;
  product_id: string;
  product_code: string;
  product_name: string;
  unit_id: string;
  unit_name: string;
  transaction_type: "receive" | "sale" | "return" | "adjustment";
  quantity: number;
  balance_after: number;
  note: string | null;
  created_at: string;
  // ✅ เพิ่ม original fields
  original_quantity?: number | null;
  original_unit_id?: string | null;
  original_unit?: { name: string } | null;
};

type ReportData = {
  success: boolean;
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  summary: {
    total_receive: number;
    total_sale: number;
    total_return: number;
    net_change: number;
  };
};

type Props = {
  initialEmployees: EmployeeOption[];
  initialStores: StoreOption[];
  initialProducts: ProductOption[];
  initialUnits: UnitOption[];
};

type FiltersState = {
  employee_id: string;
  store_id: string;
  product_id: string;
  unit_id: string;
  transaction_type: TransactionType;
  start_date: string;
  end_date: string;
  page: number;
  limit: number;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: ReportData }
  | { status: "error"; message: string };

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getTransactionTypeLabel(type: Transaction["transaction_type"]): string {
  const labels = {
    receive: "รับเข้า",
    sale: "ขาย",
    return: "รับคืน",
    adjustment: "ปรับปรุง",
  };
  return labels[type] || type;
}

function getTransactionTypeColor(type: Transaction["transaction_type"]): string {
  const colors = {
    receive: "text-emerald-600 bg-emerald-50",
    sale: "text-rose-600 bg-rose-50",
    return: "text-orange-600 bg-orange-50",
    adjustment: "text-blue-600 bg-blue-50",
  };
  return colors[type] || "text-slate-600 bg-slate-50";
}

function getStockLevelColor(balance: number): { bgColor: string; textColor: string; label: string } {
  if (balance === 0) {
    return { bgColor: "bg-slate-100", textColor: "text-slate-600", label: "หมด" };
  }
  if (balance <= 10) {
    return { bgColor: "bg-red-100", textColor: "text-red-700", label: "ต่ำ" };
  }
  if (balance <= 50) {
    return { bgColor: "bg-yellow-100", textColor: "text-yellow-700", label: "ปานกลาง" };
  }
  return { bgColor: "bg-emerald-100", textColor: "text-emerald-700", label: "ดี" };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
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

export default function StockMovementReportClient({
  initialEmployees,
  initialStores,
  initialProducts,
  initialUnits,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Default to today's date range
  const today = toIsoDate(startOfToday());
  const oneMonthAgo = toIsoDate(
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, new Date().getUTCDate()))
  );

  // Read from URL or use defaults
  const [filters, setFilters] = useState<FiltersState>(() => {
    const employee_id = searchParams.get("employee_id") || "";
    const store_id = searchParams.get("store_id") || "";
    const product_id = searchParams.get("product_id") || "";
    const unit_id = searchParams.get("unit_id") || "";
    const transaction_type = (searchParams.get("transaction_type") || "all") as TransactionType;
    const start_date = searchParams.get("start_date") || oneMonthAgo;
    const end_date = searchParams.get("end_date") || today;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    return {
      employee_id,
      store_id,
      product_id,
      unit_id,
      transaction_type,
      start_date,
      end_date,
      page,
      limit,
    };
  });

  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [searchTerm, setSearchTerm] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  // Filter units by selected product
  const filteredUnits = useMemo(() => {
    if (!filters.product_id) return [];
    return initialUnits.filter((unit) => unit.product_id === filters.product_id);
  }, [filters.product_id, initialUnits]);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.employee_id) params.set("employee_id", filters.employee_id);
    if (filters.store_id) params.set("store_id", filters.store_id);
    if (filters.product_id) params.set("product_id", filters.product_id);
    if (filters.unit_id) params.set("unit_id", filters.unit_id);
    if (filters.transaction_type !== "all") params.set("transaction_type", filters.transaction_type);
    if (filters.start_date) params.set("start_date", filters.start_date);
    if (filters.end_date) params.set("end_date", filters.end_date);
    params.set("page", String(filters.page));
    params.set("limit", String(filters.limit));

    router.replace(`?${params.toString()}`, { scroll: false });
  }, [filters, router]);

  // Fetch data
  useEffect(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    if (filters.employee_id) params.set("employee_id", filters.employee_id);
    if (filters.store_id) params.set("store_id", filters.store_id);
    if (filters.product_id) params.set("product_id", filters.product_id);
    if (filters.unit_id) params.set("unit_id", filters.unit_id);
    if (filters.transaction_type !== "all") params.set("transaction_type", filters.transaction_type);
    if (filters.start_date) params.set("start_date", filters.start_date);
    if (filters.end_date) params.set("end_date", filters.end_date);
    params.set("page", String(filters.page));
    params.set("limit", String(filters.limit));

    setState({ status: "loading" });
    void fetch(`/api/stock/transactions?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "ไม่สามารถโหลดรายงานได้");
        }
        const payload = (await response.json()) as ReportData;
        setState({ status: "success", data: payload });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "ไม่สามารถโหลดรายงานได้";
        setState({ status: "error", message });
      });

    return () => {
      controller.abort();
    };
  }, [filters]);

  const handleChange = (key: keyof FiltersState, value: string) => {
    setFilters((prev) => {
      if (key === "page") {
        return { ...prev, page: Number(value) };
      }
      if (key === "limit") {
        return { ...prev, limit: Number(value), page: 1 };
      }
      if (key === "product_id") {
        // Reset unit when product changes
        return { ...prev, product_id: value, unit_id: "", page: 1 };
      }
      return { ...prev, [key]: value, page: 1 };
    });
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleReset = () => {
    setFilters({
      employee_id: "",
      store_id: "",
      product_id: "",
      unit_id: "",
      transaction_type: "all",
      start_date: oneMonthAgo,
      end_date: today,
      page: 1,
      limit: 50,
    });
  };

  const handleExportCsv = () => {
    if (state.status !== "success") return;

    const headers = [
      "วันที่-เวลา",
      "พนักงาน",
      "ร้าน",
      "รหัสสินค้า",
      "ชื่อสินค้า",
      "หน่วย",
      "ประเภท",
      "จำนวน",
      "คงเหลือ",
      "หมายเหตุ",
    ];

    // ✅ Use grouped transactions for export
    const rows = groupedTransactions.map((t) => {
      // Format units display: "100 ลัง, 100 แพ็ค, 100 ซอง"
      const unitsDisplay = t.units
        .map((u) => `${u.quantity.toLocaleString("th-TH")} ${u.unitName}`)
        .join(", ");

      return [
        formatDate(t.created_at),
        t.employee_name,
        t.store_name,
        t.product_code,
        t.product_name,
        t.units.map((u) => u.unitName).join(", "),  // หน่วย
        getTransactionTypeLabel(t.transaction_type),
        unitsDisplay,  // จำนวน (รวมทุกหน่วย)
        t.balance_after.toString(),
        t.note || "",
      ];
    });

    const csv = stringify([headers, ...rows], { bom: true, quoted: true });
    const filename = `stock-report-${Date.now()}.csv`;
    downloadBlob(csv, "text/csv;charset=utf-8", filename);
  };

  const handleExportExcel = async () => {
    if (state.status !== "success") return;

    const params = new URLSearchParams();
    if (filters.employee_id) params.set("employee_id", filters.employee_id);
    if (filters.store_id) params.set("store_id", filters.store_id);
    if (filters.product_id) params.set("product_id", filters.product_id);
    if (filters.unit_id) params.set("unit_id", filters.unit_id);
    if (filters.transaction_type !== "all") params.set("transaction_type", filters.transaction_type);
    if (filters.start_date) params.set("start_date", filters.start_date);
    if (filters.end_date) params.set("end_date", filters.end_date);
    params.set("export", "xlsx");

    const response = await fetch(`/api/stock/transactions?${params.toString()}`);
    if (!response.ok) {
      alert("ไม่สามารถ export ไฟล์ได้");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stock-report-${Date.now()}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = async () => {
    if (state.status !== "success" || !state.data) return;

    // Fetch ALL pages for printing
    const totalPages = state.data.pagination.total_pages;
    const allTransactions: Transaction[] = [];

    try {
      for (let page = 1; page <= totalPages; page++) {
        const params = new URLSearchParams();
        if (filters.employee_id) params.set("employee_id", filters.employee_id);
        if (filters.store_id) params.set("store_id", filters.store_id);
        if (filters.product_id) params.set("product_id", filters.product_id);
        if (filters.unit_id) params.set("unit_id", filters.unit_id);
        if (filters.transaction_type !== "all") params.set("transaction_type", filters.transaction_type);
        if (filters.start_date) params.set("start_date", filters.start_date);
        if (filters.end_date) params.set("end_date", filters.end_date);
        params.set("page", String(page));
        params.set("limit", String(filters.limit));

        const response = await fetch(`/api/stock/transactions?${params.toString()}`);
        if (!response.ok) {
          alert("ไม่สามารถโหลดข้อมูลทั้งหมดสำหรับพิมพ์ได้");
          return;
        }
        const payload = await response.json() as ReportData;
        allTransactions.push(...payload.transactions);
      }
    } catch (error) {
      console.error("Failed to fetch all data for printing:", error);
      alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
      return;
    }

    // ✅ Group all transactions before printing (same logic as display)
    type GroupedPrintTransaction = {
      employee_name: string;
      store_name: string;
      product_code: string;
      product_name: string;
      transaction_type: "receive" | "sale" | "return" | "adjustment";
      balance_after: number;
      note: string | null;
      created_at: string;
      units: Array<{ unitName: string; quantity: number }>;
    };

    const printGroups: GroupedPrintTransaction[] = [];
    const unitOrder = ["ลัง", "แพ็ค", "ซอง", "ปี๊บ", "กล่อง", "ชิ้น", "ขวด", "ถุง", "แกลลอน", "ถัง"];

    for (const txn of allTransactions) {
      const txnTime = new Date(txn.created_at).getTime();
      const displayQuantity = txn.original_quantity ?? txn.quantity;
      const displayUnitName = txn.original_unit?.name ?? txn.unit_name;

      const existingGroup = printGroups.find((g) => {
        const groupTime = new Date(g.created_at).getTime();
        const timeDiff = Math.abs(txnTime - groupTime);
        return (
          g.product_code === txn.product_code &&
          g.employee_name === txn.employee_name &&
          g.store_name === txn.store_name &&
          g.transaction_type === txn.transaction_type &&
          timeDiff <= 60000
        );
      });

      if (existingGroup) {
        const existingUnit = existingGroup.units.find((u) => u.unitName === displayUnitName);
        if (existingUnit) {
          existingUnit.quantity += displayQuantity;
        } else {
          existingGroup.units.push({ unitName: displayUnitName, quantity: displayQuantity });
        }
        existingGroup.balance_after = txn.balance_after;
        if (txn.note && !existingGroup.note?.includes(txn.note)) {
          existingGroup.note = existingGroup.note ? `${existingGroup.note} | ${txn.note}` : txn.note;
        }
      } else {
        printGroups.push({
          employee_name: txn.employee_name,
          store_name: txn.store_name,
          product_code: txn.product_code,
          product_name: txn.product_name,
          transaction_type: txn.transaction_type,
          balance_after: txn.balance_after,
          note: txn.note,
          created_at: txn.created_at,
          units: [{ unitName: displayUnitName, quantity: displayQuantity }],
        });
      }
    }

    // Sort units within groups
    printGroups.forEach((group) => {
      group.units.sort((a, b) => {
        const indexA = unitOrder.indexOf(a.unitName);
        const indexB = unitOrder.indexOf(b.unitName);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.unitName.localeCompare(b.unitName, 'th');
      });
    });

    // Create print-friendly HTML
    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>รายงานการเคลื่อนไหวสต็อก</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: A4 landscape;
      margin: 10mm;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
    }

    .container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #333;
    }

    h1 {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 5px;
    }

    .header-info {
      font-size: 10px;
      color: #555;
    }

    .summary {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
      padding: 10px;
      border: 1px solid #ddd;
      background-color: #f9f9f9;
    }

    .summary-item {
      flex: 1;
      text-align: center;
    }

    .summary-item .label {
      font-size: 9px;
      color: #666;
      margin-bottom: 3px;
    }

    .summary-item .value {
      font-size: 16px;
      font-weight: bold;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }

    th {
      background: #f5f5f5;
      border: 1px solid #333;
      padding: 6px 4px;
      text-align: left;
      font-weight: bold;
      font-size: 10px;
      white-space: nowrap;
    }

    td {
      border: 1px solid #333;
      padding: 5px 4px;
      font-size: 10px;
      white-space: nowrap;
    }

    .text-center {
      text-align: center;
    }

    .text-right {
      text-align: right;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 9px;
      font-weight: 600;
    }

    .badge-receive {
      background: #d1fae5;
      color: #047857;
    }

    .badge-sale {
      background: #fee2e2;
      color: #dc2626;
    }

    .badge-return {
      background: #fed7aa;
      color: #ea580c;
    }

    .badge-adjustment {
      background: #dbeafe;
      color: #2563eb;
    }

    .font-bold {
      font-weight: bold;
    }

    .print-timestamp {
      margin-top: 10px;
      font-size: 9px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>รายงานการเคลื่อนไหวสต็อก</h1>
        <div class="header-info">
          ระยะเวลา: ${filters.start_date} ถึง ${filters.end_date}
        </div>
      </div>
      <div class="header-info" style="text-align: right;">
        <div>พนักงาน: ${initialEmployees.find(e => e.id === filters.employee_id)?.name || "ทั้งหมด"}</div>
        <div>ร้านค้า: ${initialStores.find(s => s.id === filters.store_id)?.name || "ทั้งหมด"}</div>
        <div>สินค้า: ${initialProducts.find(p => p.id === filters.product_id)?.name || "ทั้งหมด"}</div>
      </div>
    </header>

    <div class="summary">
      <div class="summary-item">
        <div class="label">📥 รับเข้า</div>
        <div class="value" style="color: #047857;">${state.data.summary.total_receive.toLocaleString("th-TH")}</div>
      </div>
      <div class="summary-item">
        <div class="label">💰 ขาย</div>
        <div class="value" style="color: #dc2626;">${state.data.summary.total_sale.toLocaleString("th-TH")}</div>
      </div>
      <div class="summary-item">
        <div class="label">📤 รับคืน</div>
        <div class="value" style="color: #ea580c;">${state.data.summary.total_return.toLocaleString("th-TH")}</div>
      </div>
      <div class="summary-item">
        <div class="label">📊 คงเหลือสุทธิ</div>
        <div class="value" style="color: #2563eb;">${state.data.summary.net_change.toLocaleString("th-TH")}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>วันที่-เวลา</th>
          <th>พนักงาน</th>
          <th>ร้าน</th>
          <th>สินค้า</th>
          <th>หน่วย</th>
          <th class="text-center">ประเภท</th>
          <th class="text-right">จำนวน</th>
          <th class="text-right">คงเหลือ</th>
          <th>หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>
        ${printGroups.map(t => {
          // Format units display for print (แนวนอน)
          const unitsDisplay = t.units
            .map((u) => `${u.quantity.toLocaleString("th-TH")} ${u.unitName}`)
            .join(" • ");

          return `
          <tr>
            <td>${formatDate(t.created_at)}</td>
            <td>${t.employee_name}</td>
            <td>${t.store_name}</td>
            <td>${t.product_name} <span style="color: #666;">(${t.product_code})</span></td>
            <td>${t.units.map((u) => u.unitName).join(", ")}</td>
            <td class="text-center">
              <span class="badge badge-${t.transaction_type}">${getTransactionTypeLabel(t.transaction_type)}</span>
            </td>
            <td class="text-right font-bold">${unitsDisplay}</td>
            <td class="text-right font-bold" style="color: #2563eb;">${t.balance_after.toLocaleString("th-TH")}</td>
            <td>${t.note || "-"}</td>
          </tr>
        `;
        }).join("")}
      </tbody>
    </table>

    <div class="print-timestamp">
      พิมพ์เอกสารเมื่อ: ${new Intl.DateTimeFormat("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date())}
    </div>
  </div>
</body>
</html>
    `;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const toolbarDisabled = state.status === "loading";
  const report = state.status === "success" ? state.data : null;

  // ✅ Group transactions by product + employee + store + type + time (within 1 minute)
  const groupedTransactions = useMemo(() => {
    if (!report || !report.transactions) return [];

    const transactions = report.transactions;

    type GroupedTransaction = {
      groupKey: string;
      id: string;
      employee_id: string;
      employee_name: string;
      store_id: string;
      store_name: string;
      product_id: string;
      product_code: string;
      product_name: string;
      transaction_type: "receive" | "sale" | "return" | "adjustment";
      balance_after: number;
      note: string | null;
      created_at: string;
      units: Array<{ unitId: string; unitName: string; quantity: number }>;
    };

    const groups: GroupedTransaction[] = [];

    for (const txn of transactions) {
      const txnTime = new Date(txn.created_at).getTime();

      // Get display values (original if available, fallback to base)
      const displayQuantity = txn.original_quantity ?? txn.quantity;
      const displayUnitId = txn.original_unit_id ?? txn.unit_id;
      const displayUnitName = txn.original_unit?.name ?? txn.unit_name;

      // Find existing group (same product + employee + store + type + within 1 minute)
      const existingGroup = groups.find((g) => {
        const groupTime = new Date(g.created_at).getTime();
        const timeDiff = Math.abs(txnTime - groupTime);
        return (
          g.product_id === txn.product_id &&
          g.employee_id === txn.employee_id &&
          g.store_id === txn.store_id &&
          g.transaction_type === txn.transaction_type &&
          timeDiff <= 60000  // ภายใน 1 นาที = รายการเดียวกัน
        );
      });

      if (existingGroup) {
        // Add to existing group
        const existingUnit = existingGroup.units.find((u) => u.unitId === displayUnitId);
        if (existingUnit) {
          existingUnit.quantity += displayQuantity;
        } else {
          existingGroup.units.push({
            unitId: displayUnitId,
            unitName: displayUnitName,
            quantity: displayQuantity,
          });
        }
        // Update balance_after to latest
        existingGroup.balance_after = txn.balance_after;
        // Merge notes
        if (txn.note && !existingGroup.note?.includes(txn.note)) {
          existingGroup.note = existingGroup.note
            ? `${existingGroup.note} | ${txn.note}`
            : txn.note;
        }
      } else {
        // Create new group
        groups.push({
          groupKey: `${txn.product_id}-${txn.employee_id}-${txn.store_id}-${txn.transaction_type}-${txn.created_at}`,
          id: txn.id,
          employee_id: txn.employee_id,
          employee_name: txn.employee_name,
          store_id: txn.store_id,
          store_name: txn.store_name,
          product_id: txn.product_id,
          product_code: txn.product_code,
          product_name: txn.product_name,
          transaction_type: txn.transaction_type,
          balance_after: txn.balance_after,
          note: txn.note,
          created_at: txn.created_at,
          units: [{
            unitId: displayUnitId,
            unitName: displayUnitName,
            quantity: displayQuantity,
          }],
        });
      }
    }

    // Sort units within each group by size (largest first)
    const unitOrder = ["ลัง", "แพ็ค", "ซอง", "ปี๊บ", "กล่อง", "ชิ้น", "ขวด", "ถุง", "แกลลอน", "ถัง"];
    groups.forEach((group) => {
      group.units.sort((a, b) => {
        const indexA = unitOrder.indexOf(a.unitName);
        const indexB = unitOrder.indexOf(b.unitName);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.unitName.localeCompare(b.unitName, 'th');
      });
    });

    return groups;
  }, [report]);

  // Filter grouped transactions by search term
  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return groupedTransactions;

    const term = searchTerm.toLowerCase();
    return groupedTransactions.filter((transaction) => {
      return (
        transaction.employee_name.toLowerCase().includes(term) ||
        transaction.store_name.toLowerCase().includes(term) ||
        transaction.product_code.toLowerCase().includes(term) ||
        transaction.product_name.toLowerCase().includes(term) ||
        transaction.units.some((u) => u.unitName.toLowerCase().includes(term)) ||
        (transaction.note && transaction.note.toLowerCase().includes(term))
      );
    });
  }, [groupedTransactions, searchTerm]);

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      <header className="space-y-3 print:hidden">
        <h1 className="text-2xl font-semibold text-slate-900 -mt-4 mb-2">รายงานการเคลื่อนไหวสต็อก</h1>
        <p className="text-sm text-slate-500">
          ติดตามการรับเข้า ขาย และรับคืนสินค้า พร้อมยอดคงเหลือ
        </p>
      </header>

      {/* Filter Section */}
      <section className="print:hidden rounded-3xl border border-blue-100 bg-white/90 p-3 sm:p-5 shadow-[0_30px_120px_-110px_rgba(37,99,235,0.8)]">
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}
        >
          {/* Date Range Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              ช่วงเวลาด่วน:
            </span>
            <button
              type="button"
              onClick={() => {
                const today = toIsoDate(startOfToday());
                setFilters(prev => ({ ...prev, start_date: today, end_date: today, page: 1 }));
              }}
              className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
            >
              วันนี้
            </button>
            <button
              type="button"
              onClick={() => {
                const today = toIsoDate(startOfToday());
                const sevenDaysAgo = toIsoDate(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - 6)));
                setFilters(prev => ({ ...prev, start_date: sevenDaysAgo, end_date: today, page: 1 }));
              }}
              className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              7 วันล่าสุด
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const firstDay = toIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
                const today = toIsoDate(startOfToday());
                setFilters(prev => ({ ...prev, start_date: firstDay, end_date: today, page: 1 }));
              }}
              className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 transition hover:bg-purple-100"
            >
              เดือนนี้
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const firstDayLastMonth = toIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
                const lastDayLastMonth = toIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)));
                setFilters(prev => ({ ...prev, start_date: firstDayLastMonth, end_date: lastDayLastMonth, page: 1 }));
              }}
              className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 transition hover:bg-orange-100"
            >
              เดือนที่แล้ว
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">วันที่เริ่มต้น</label>
              <input
                type="date"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
                value={filters.start_date}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  handleChange("start_date", event.target.value)
                }
                disabled={toolbarDisabled}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">วันที่สิ้นสุด</label>
              <input
                type="date"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
                value={filters.end_date}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  handleChange("end_date", event.target.value)
                }
                disabled={toolbarDisabled}
              />
            </div>

            {/* Employee */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">พนักงาน</label>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
                value={filters.employee_id}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  handleChange("employee_id", event.target.value)
                }
                disabled={toolbarDisabled}
              >
                <option value="">ทั้งหมด</option>
                {initialEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Store */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">ร้านค้า</label>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
                value={filters.store_id}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  handleChange("store_id", event.target.value)
                }
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

            {/* Product */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">สินค้า</label>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
                value={filters.product_id}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  handleChange("product_id", event.target.value)
                }
                disabled={toolbarDisabled}
              >
                <option value="">ทั้งหมด</option>
                {initialProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} - {product.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">หน่วย</label>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                value={filters.unit_id}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  handleChange("unit_id", event.target.value)
                }
                disabled={toolbarDisabled || !filters.product_id}
              >
                <option value="">ทั้งหมด</option>
                {filteredUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} {unit.sku ? `(${unit.sku})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction Type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">ประเภท</label>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
                value={filters.transaction_type}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  handleChange("transaction_type", event.target.value)
                }
                disabled={toolbarDisabled}
              >
                <option value="all">ทั้งหมด</option>
                <option value="receive">รับเข้า</option>
                <option value="sale">ขาย</option>
                <option value="return">รับคืน</option>
                <option value="adjustment">ปรับปรุง</option>
              </select>
            </div>

            {/* Page Size */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">จำนวนรายการต่อหน้า</label>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none"
                value={filters.limit}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  handleChange("limit", event.target.value)
                }
                disabled={toolbarDisabled}
              >
                {[20, 50, 100, 200].map((size) => (
                  <option key={size} value={size}>
                    {size} รายการ
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={toolbarDisabled}
            >
              รีเซ็ต
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={state.status !== "success"}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={state.status !== "success"}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Export Excel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={state.status !== "success"}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-sky-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_60px_-35px_rgba(49,46,129,0.8)] transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              พิมพ์ / PDF
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
        </form>
      </section>

      {/* Search Box */}
      {report && report.transactions.length > 0 && (
        <div className="print:hidden">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหา พนักงาน, ร้าน, สินค้า, หมายเหตุ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title="ล้างการค้นหา"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="mt-2 text-xs text-slate-500">
              พบ <span className="font-semibold text-blue-600">{filteredTransactions.length}</span> รายการจากทั้งหมด {report.transactions.length} รายการ
            </p>
          )}
        </div>
      )}

      {/* Summary Cards */}
      {report && (
        <section className="grid gap-4 grid-cols-2 lg:grid-cols-4 print:hidden">
          {/* รับเข้า */}
          <div className="group rounded-3xl border border-white/70 bg-white/95 p-6 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl lg:backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  รับเข้า
                </p>
                <p className="mt-2 text-3xl font-bold text-blue-900">
                  {report.summary.total_receive.toLocaleString("th-TH")}
                </p>
                <p className="mt-1 text-xs text-slate-500">หน่วย</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-lg transition-all duration-200 group-hover:scale-110">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 border border-white/40">
                  <PackagePlus className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* ขาย */}
          <div className="group rounded-3xl border border-white/70 bg-white/95 p-6 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl lg:backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  ขาย
                </p>
                <p className="mt-2 text-3xl font-bold text-blue-900">
                  {report.summary.total_sale.toLocaleString("th-TH")}
                </p>
                <p className="mt-1 text-xs text-slate-500">หน่วย</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 shadow-lg transition-all duration-200 group-hover:scale-110">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 border border-white/40">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* รับคืน */}
          <div className="group rounded-3xl border border-white/70 bg-white/95 p-6 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl lg:backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  รับคืน
                </p>
                <p className="mt-2 text-3xl font-bold text-blue-900">
                  {report.summary.total_return.toLocaleString("th-TH")}
                </p>
                <p className="mt-1 text-xs text-slate-500">หน่วย</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 shadow-lg transition-all duration-200 group-hover:scale-110">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 border border-white/40">
                  <PackageMinus className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* คงเหลือสุทธิ */}
          <div className="group rounded-3xl border border-white/70 bg-white/95 p-6 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl lg:backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  คงเหลือสุทธิ
                </p>
                <p className="mt-2 text-3xl font-bold text-blue-900">
                  {report.summary.net_change.toLocaleString("th-TH")}
                </p>
                <p className="mt-1 text-xs text-slate-500">หน่วย</p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 shadow-lg transition-all duration-200 group-hover:scale-110">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 border border-white/40">
                  <Package className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Data Table - Desktop */}
      {report && filteredTransactions.length > 0 && (
        <>
          {/* Desktop Table View */}
          <section className="hidden md:block overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                      วันที่-เวลา
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600" />
                        พนักงาน
                      </div>
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                      ร้าน
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                      สินค้า
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                      หน่วย
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-center font-semibold text-slate-700">
                      ประเภท
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold text-slate-700">
                      จำนวน
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold text-slate-700">
                      คงเหลือ
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                      หมายเหตุ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction, index) => (
                    <tr
                      key={transaction.id}
                      className={index % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                    >
                      <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                        {formatDate(transaction.created_at)}
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                        {transaction.employee_name}
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                        {transaction.store_name}
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3 text-slate-900 font-medium">
                        {transaction.product_name}
                        <span className="ml-2 text-xs text-slate-500">
                          ({transaction.product_code})
                        </span>
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3 text-slate-700">
                        {transaction.units.map((u) => u.unitName).join(", ")}
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getTransactionTypeColor(
                            transaction.transaction_type
                          )}`}
                        >
                          {getTransactionTypeLabel(transaction.transaction_type)}
                        </span>
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {transaction.units.map((u, idx) => (
                          <span key={idx}>
                            {idx > 0 && <span className="mx-1 text-slate-400">•</span>}
                            <span className="text-slate-900">{u.quantity.toLocaleString("th-TH")}</span>{" "}
                            <span className="text-xs text-slate-500 font-normal">{u.unitName}</span>
                          </span>
                        ))}
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-semibold text-blue-900">
                            {transaction.balance_after.toLocaleString("th-TH")}{" "}
                            <span className="text-xs text-slate-500 font-normal">หน่วยฐาน</span>
                          </span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStockLevelColor(transaction.balance_after).bgColor} ${getStockLevelColor(transaction.balance_after).textColor}`}>
                            {getStockLevelColor(transaction.balance_after).label}
                          </span>
                        </div>
                      </td>
                      <td className="border-b border-slate-200 px-4 py-3 text-slate-600 text-xs">
                        {transaction.note || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {report.pagination && report.pagination.total_pages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">
                    แสดง{" "}
                    {((report.pagination.page - 1) * report.pagination.limit + 1).toLocaleString(
                      "th-TH"
                    )}{" "}
                    -{" "}
                    {Math.min(
                      report.pagination.page * report.pagination.limit,
                      report.pagination.total
                    ).toLocaleString("th-TH")}{" "}
                    จาก {report.pagination.total.toLocaleString("th-TH")} รายการ
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePageChange(report.pagination.page - 1)}
                    disabled={report.pagination.page === 1}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ก่อนหน้า
                  </button>
                  <span className="px-3 text-sm text-slate-600">
                    หน้า {report.pagination.page} จาก {report.pagination.total_pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePageChange(report.pagination.page + 1)}
                    disabled={report.pagination.page === report.pagination.total_pages}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Mobile Card View */}
          <section className="md:hidden space-y-3">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                {/* Header with Type Badge */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1 text-xs text-slate-500">
                      {formatDate(transaction.created_at)}
                    </div>
                    <div className="font-semibold text-slate-900">
                      {transaction.product_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {transaction.product_code}
                    </div>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getTransactionTypeColor(
                      transaction.transaction_type
                    )}`}
                  >
                    {getTransactionTypeLabel(transaction.transaction_type)}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">พนักงาน:</span>
                    <span className="font-medium text-slate-900">
                      {transaction.employee_name}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">ร้านค้า:</span>
                    <span className="font-medium text-slate-900">{transaction.store_name}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-2 text-sm">
                    <span className="text-slate-600">จำนวน:</span>
                    <div className="text-right text-lg font-bold text-slate-900">
                      {transaction.units.map((u, idx) => (
                        <span key={idx}>
                          {idx > 0 && <span className="mx-1 text-slate-400">•</span>}
                          <span className="text-slate-900">{u.quantity.toLocaleString("th-TH")}</span>{" "}
                          <span className="text-sm text-slate-500 font-normal">{u.unitName}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">คงเหลือหลังทำรายการ:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-blue-900">
                        {transaction.balance_after.toLocaleString("th-TH")}{" "}
                        <span className="text-sm text-slate-500 font-normal">หน่วยฐาน</span>
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStockLevelColor(transaction.balance_after).bgColor} ${getStockLevelColor(transaction.balance_after).textColor}`}>
                        {getStockLevelColor(transaction.balance_after).label}
                      </span>
                    </div>
                  </div>
                  {transaction.note && (
                    <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                      <span className="font-semibold">หมายเหตุ:</span> {transaction.note}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Mobile Pagination */}
            {report.pagination && report.pagination.total_pages > 1 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-center text-sm text-slate-600">
                  แสดง{" "}
                  {((report.pagination.page - 1) * report.pagination.limit + 1).toLocaleString(
                    "th-TH"
                  )}{" "}
                  -{" "}
                  {Math.min(
                    report.pagination.page * report.pagination.limit,
                    report.pagination.total
                  ).toLocaleString("th-TH")}{" "}
                  จาก {report.pagination.total.toLocaleString("th-TH")} รายการ
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handlePageChange(report.pagination.page - 1)}
                    disabled={report.pagination.page === 1}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ก่อนหน้า
                  </button>
                  <span className="px-3 text-sm font-medium text-slate-700">
                    {report.pagination.page} / {report.pagination.total_pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePageChange(report.pagination.page + 1)}
                    disabled={report.pagination.page === report.pagination.total_pages}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Empty State */}
      {report && report.transactions.length === 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <span className="text-3xl">📦</span>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-900">ไม่พบข้อมูล</h3>
          <p className="text-sm text-slate-500">ไม่มีรายการเคลื่อนไหวสต็อกในช่วงที่เลือก</p>
        </div>
      )}
    </div>
  );
}
