/**
 * Dashboard Export Utilities
 * Provides functions to export dashboard data in various formats
 */

type ExportFormat = "csv" | "json" | "pdf";

/**
 * Converts an array of objects to CSV format
 */
function arrayToCSV<T extends Record<string, unknown>>(data: T[], filename: string): void {
  if (data.length === 0) {
    alert("No data to export");
    return;
  }

  // Extract headers from the first object
  const headers = Object.keys(data[0]!);

  // Create CSV rows
  const csvRows = [
    // Header row
    headers.join(","),
    // Data rows
    ...data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        // Escape values containing commas or quotes
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? "";
      }).join(",")
    ),
  ];

  const csvContent = csvRows.join("\n");
  downloadFile(csvContent, filename, "text/csv");
}

/**
 * Converts data to JSON and downloads it
 */
function dataToJSON<T>(data: T, filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, "application/json");
}

/**
 * Creates a download link and triggers it
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Generates a timestamp string for filenames
 */
function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").slice(0, -5);
}

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
});

const formatCurrencyValue = (value: unknown) =>
  currencyFormatter.format(typeof value === "number" ? value : Number(value ?? 0));

const asNumber = (value: unknown) =>
  typeof value === "number" ? value : Number(value ?? 0);

/**
 * Export timeline data
 */
export function exportTimelineData(
  data: Array<Record<string, unknown>>,
  format: ExportFormat = "csv"
): void {
  const timestamp = getTimestamp();
  const filename = `dashboard-timeline-${timestamp}`;

  if (format === "csv") {
    arrayToCSV(data, `${filename}.csv`);
  } else if (format === "json") {
    dataToJSON(data, `${filename}.json`);
  } else {
    alert("PDF export coming soon!");
  }
}

/**
 * Export store performance data
 */
export function exportStorePerformance(
  data: Array<Record<string, unknown>>,
  format: ExportFormat = "csv"
): void {
  const timestamp = getTimestamp();
  const filename = `store-performance-${timestamp}`;

  if (format === "csv") {
    arrayToCSV(data, `${filename}.csv`);
  } else if (format === "json") {
    dataToJSON(data, `${filename}.json`);
  } else {
    alert("PDF export coming soon!");
  }
}

/**
 * Export employee performance data
 */
export function exportEmployeePerformance(
  data: Array<Record<string, unknown>>,
  format: ExportFormat = "csv"
): void {
  const timestamp = getTimestamp();
  const filename = `employee-performance-${timestamp}`;

  if (format === "csv") {
    arrayToCSV(data, `${filename}.csv`);
  } else if (format === "json") {
    dataToJSON(data, `${filename}.json`);
  } else {
    alert("PDF export coming soon!");
  }
}

/**
 * Export product performance data
 */
export function exportProductPerformance(
  data: Array<Record<string, unknown>>,
  format: ExportFormat = "csv"
): void {
  const timestamp = getTimestamp();
  const filename = `product-performance-${timestamp}`;

  if (format === "csv") {
    arrayToCSV(data, `${filename}.csv`);
  } else if (format === "json") {
    dataToJSON(data, `${filename}.json`);
  } else {
    alert("PDF export coming soon!");
  }
}

/**
 * Export complete dashboard data
 */
export function exportCompleteDashboard(
  data: unknown,
  format: ExportFormat = "json"
): void {
  const timestamp = getTimestamp();
  const filename = `dashboard-complete-${timestamp}`;

  if (format === "json") {
    dataToJSON(data, `${filename}.json`);
  } else if (format === "csv") {
    // For CSV, export the main tables
    alert("CSV export available for individual tables. Use JSON for complete data export.");
  } else {
    alert("PDF export coming soon!");
  }
}

type SummaryReportData = {
  kpis: {
    revenue: { current: number; previous: number; growth: number };
    transactions: { current: number; previous: number; growth: number };
    avgTicket: { current: number; previous: number; growth: number };
    checkIns: { current: number; previous: number; growth: number };
    activeEmployees: { current: number; previous: number; growth: number };
  };
  stores: Array<Record<string, unknown>>;
  employees: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  metadata: {
    totalEmployees: number;
    totalStores: number;
    totalProducts: number;
    dataPoints: { attendance: number; sales: number };
    timezone: string;
  };
};

/**
 * Generate and download a summary report
 */
export function exportSummaryReport(data: SummaryReportData): void {
  const timestamp = getTimestamp();
  const filename = `dashboard-summary-${timestamp}.txt`;

  const report = `
DASHBOARD SUMMARY REPORT
Generated: ${new Date().toLocaleString("th-TH")}
Timezone: ${data.metadata.timezone}
================================================================================

KEY PERFORMANCE INDICATORS
---------------------------
Revenue:
  Current Period: ${formatCurrencyValue(data.kpis.revenue.current)}
  Previous Period: ${formatCurrencyValue(data.kpis.revenue.previous)}
  Growth: ${asNumber(data.kpis.revenue.growth).toFixed(2)}%

Transactions:
  Current: ${data.kpis.transactions.current}
  Previous: ${data.kpis.transactions.previous}
  Growth: ${asNumber(data.kpis.transactions.growth).toFixed(2)}%

Average Ticket:
  Current: ${formatCurrencyValue(data.kpis.avgTicket.current)}
  Previous: ${formatCurrencyValue(data.kpis.avgTicket.previous)}
  Growth: ${asNumber(data.kpis.avgTicket.growth).toFixed(2)}%

Check-ins:
  Current: ${data.kpis.checkIns.current}
  Previous: ${data.kpis.checkIns.previous}
  Growth: ${asNumber(data.kpis.checkIns.growth).toFixed(2)}%

Active Employees:
  Current: ${data.kpis.activeEmployees.current}
  Previous: ${data.kpis.activeEmployees.previous}
  Growth: ${asNumber(data.kpis.activeEmployees.growth).toFixed(2)}%

TOP PERFORMING STORES
---------------------
${data.stores.slice(0, 5).map((store, index) => `
${index + 1}. ${store.name}
   Revenue: ${formatCurrencyValue(store.revenue)}
   Transactions: ${asNumber(store.transactions)}
   Active Employees: ${asNumber(store.activeEmployees)}
`).join("")}

TOP PERFORMING EMPLOYEES
------------------------
${data.employees.slice(0, 5).map((emp, index) => `
${index + 1}. ${emp.name}
   Revenue: ${formatCurrencyValue(emp.revenue)}
   Transactions: ${asNumber(emp.transactions)}
   Check-ins: ${asNumber(emp.checkIns)}
`).join("")}

TOP SELLING PRODUCTS
--------------------
${data.products.slice(0, 5).map((prod, index) => `
${index + 1}. ${prod.name}
   Revenue: ${formatCurrencyValue(prod.revenue)}
   Quantity Sold: ${asNumber(prod.quantity)}
   Transactions: ${asNumber(prod.transactions)}
`).join("")}

DATA SUMMARY
------------
Total Employees: ${data.metadata.totalEmployees}
Total Stores: ${data.metadata.totalStores}
Total Products: ${data.metadata.totalProducts}
Attendance Records: ${data.metadata.dataPoints.attendance}
Sales Records: ${data.metadata.dataPoints.sales}

================================================================================
End of Report
`;

  downloadFile(report, filename, "text/plain");
}
