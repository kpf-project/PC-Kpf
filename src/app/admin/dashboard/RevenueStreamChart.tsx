"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";
import type { DashboardMetrics } from "@/lib/configStore";

interface RevenueStreamChartProps {
  metrics: DashboardMetrics;
}

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("th-TH");

export default function RevenueStreamChart({ metrics }: RevenueStreamChartProps) {
  // Build timeline dataset combining attendance and sales
  const timelineData = buildTimelineDataset(metrics);

  // SSR-safe responsive state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Only run on client-side after hydration
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };

    // Set initial values
    handleResize();

    // Update on window resize
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="rounded-3xl border-2 border-blue-100 bg-white p-4 sm:p-6 shadow-xl">
      {/* Header */}
      <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-sky-400 p-2 sm:p-3">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Revenue Stream Analysis</h3>
            <p className="text-xs sm:text-sm text-slate-500">
              <span className="hidden sm:inline">กระแสยอดขายและการลงเวลา - ช่วง {metrics.filters.rangeLabel}</span>
              <span className="sm:hidden">{metrics.filters.rangeLabel}</span>
            </p>
          </div>
        </div>

        {/* Quick Summary - Stack on mobile */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-left sm:text-right">
            <p className="text-xs text-slate-600">ยอดขายรวม</p>
            <p className="text-base sm:text-lg font-bold text-blue-600">
              {currencyFormatter.format(metrics.sales.totalRevenue)}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs text-slate-600">ธุรกรรม</p>
            <p className="text-base sm:text-lg font-bold text-emerald-600">
              {numberFormatter.format(metrics.sales.transactions)}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile View: Card List */}
      <div className="block lg:hidden space-y-3">
        {timelineData.map((entry) => (
          <div
            key={entry.key}
            className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/50 to-white p-3"
          >
            {/* Date Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-900">{entry.label}</span>
              <span className="text-xs font-semibold text-blue-600">
                {currencyFormatter.format(entry.sales)}
              </span>
            </div>

            {/* Sales Progress Bar */}
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                <span>ยอดขาย</span>
                <span>{numberFormatter.format(entry.transactions)} ธุรกรรม</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400"
                  style={{
                    width: `${Math.min((entry.sales / Math.max(...timelineData.map(d => d.sales), 1)) * 100, 100)}%`
                  }}
                />
              </div>
            </div>

            {/* Check-ins & Transactions */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-slate-600">เช็กอิน:</span>
                <span className="font-semibold text-emerald-600">{numberFormatter.format(entry.checkIns)}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-indigo-500" />
                <span className="text-slate-600">ธุรกรรม:</span>
                <span className="font-semibold text-indigo-600">{numberFormatter.format(entry.transactions)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop View: Chart - Responsive height */}
      <div className="hidden lg:block h-64 sm:h-80 lg:h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={timelineData}
            margin={{
              top: 16,
              right: isMobile ? 8 : 24,
              left: isMobile ? -10 : 0,
              bottom: 8
            }}
          >
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

            <XAxis
              dataKey="label"
              tick={{ fontSize: isMobile ? 9 : 11, fill: "#64748b" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              yAxisId="left"
              tick={{ fontSize: isMobile ? 9 : 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={isMobile ? 50 : 80}
              tickFormatter={(value) => {
                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                return value.toString();
              }}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: isMobile ? 9 : 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={isMobile ? 40 : 60}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "2px solid #e2e8f0",
                borderRadius: "12px",
                padding: isMobile ? "8px" : "12px",
                fontSize: isMobile ? "12px" : "14px",
              }}
              formatter={(value: number, name: string) => {
                if (name === "ยอดขาย") {
                  return [currencyFormatter.format(value), name];
                }
                return [numberFormatter.format(value), name];
              }}
              labelFormatter={(label) => `วันที่ ${label}`}
            />

            <Legend
              wrapperStyle={{
                fontSize: isMobile ? 10 : 12,
                paddingTop: isMobile ? "12px" : "16px"
              }}
              iconType="circle"
            />

            <Bar
              yAxisId="left"
              dataKey="sales"
              name="ยอดขาย"
              fill="url(#salesGradient)"
              radius={[8, 8, 0, 0]}
              maxBarSize={isMobile ? 30 : 60}
            />

            <Line
              yAxisId="right"
              type="monotone"
              dataKey="checkIns"
              name="เช็กอิน"
              stroke="#10b981"
              strokeWidth={isMobile ? 2 : 3}
              dot={{ fill: "#10b981", strokeWidth: 2, r: isMobile ? 3 : 4 }}
              activeDot={{ r: isMobile ? 5 : 6 }}
            />

            <Line
              yAxisId="right"
              type="monotone"
              dataKey="transactions"
              name="ธุรกรรม"
              stroke="#6366f1"
              strokeWidth={isMobile ? 2 : 3}
              dot={{ fill: "#6366f1", strokeWidth: 2, r: isMobile ? 3 : 4 }}
              activeDot={{ r: isMobile ? 5 : 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Insights - Stack on mobile */}
      <div className="mt-4 sm:mt-6 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
          <p className="text-xs font-semibold text-emerald-700 mb-1">เช็กอินรวม</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-900">
            {numberFormatter.format(metrics.attendance.checkIns)}
          </p>
          <p className="text-xs text-emerald-600 mt-1">
            {numberFormatter.format(metrics.attendance.uniqueEmployees)} พนักงาน
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 sm:p-4">
          <p className="text-xs font-semibold text-blue-700 mb-1">Avg Ticket</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-900">
            {currencyFormatter.format(metrics.sales.averageTicket)}
          </p>
          <p className="text-xs text-blue-600 mt-1">ต่อธุรกรรม</p>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 sm:p-4">
          <p className="text-xs font-semibold text-indigo-700 mb-1">จำนวนสินค้า</p>
          <p className="text-xl sm:text-2xl font-bold text-indigo-900">
            {numberFormatter.format(metrics.sales.totalQuantity)}
          </p>
          <p className="text-xs text-indigo-600 mt-1">ชิ้นทั้งหมด</p>
        </div>
      </div>
    </div>
  );
}

function buildTimelineDataset(metrics: DashboardMetrics) {
  const attendanceMap = new Map(
    metrics.attendance.timeline.map((entry) => [entry.dateKey, entry])
  );
  const salesMap = new Map(
    metrics.sales.timeline.map((entry) => [entry.dateKey, entry])
  );

  const keys = Array.from(new Set([...attendanceMap.keys(), ...salesMap.keys()]));
  keys.sort();

  return keys.map((key) => {
    const attendanceEntry = attendanceMap.get(key);
    const salesEntry = salesMap.get(key);
    return {
      key,
      label: salesEntry?.label ?? attendanceEntry?.label ?? key,
      checkIns: attendanceEntry?.checkIns ?? 0,
      checkOuts: attendanceEntry?.checkOuts ?? 0,
      sales: salesEntry?.total ?? 0,
      transactions: salesEntry?.transactions ?? 0,
    };
  });
}
