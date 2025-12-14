"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import {
  TrendingUp,
  Users,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Activity,
  MapPin,
  Clock,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Zap,
  Wifi,
  WifiOff
} from "lucide-react";
import type { DashboardMetrics } from "@/lib/configStore";
import dynamic from "next/dynamic";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

// Dynamic imports for heavy components
const ThailandStoreMap = dynamic(() => import("./dashboard/ThailandStoreMap"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const RevenueStreamChart = dynamic(() => import("./dashboard/RevenueStreamChart"), {
  loading: () => <ChartSkeleton />,
});

type DashboardSnapshot = {
  totals: {
    employees: number;
    stores: number;
    products: number;
    logs: number;
  };
  kpis: {
    period: {
      currentStart: string;
      currentEnd: string;
      previousStart: string;
      previousEnd: string;
    };
    alerts: string[];
    attendance: {
      value: number;
      previous: number;
      deltaPercent: number;
    };
    sales: {
      value: number;
      previous: number;
      deltaPercent: number;
    };
    averageTicket: {
      value: number;
      previous: number;
      deltaPercent: number;
    };
    salesTransactions: {
      value: number;
      previous: number;
      deltaPercent: number;
    };
  };
  performance: {
    timeline: Array<{
      dateKey: string;
      label: string;
      salesTotal: number;
      salesAverage: number;
      salesQuantity: number;
      checkIns: number;
      checkOuts: number;
      iso: string;
    }>;
    weekly: Array<{
      label: string;
      startIso: string;
      endIso: string;
      salesTotal: number;
      salesQuantity: number;
      checkIns: number;
    }>;
    segments: {
      store: Array<{
        id: string;
        label: string;
        salesTotal: number;
        salesCount: number;
        salesQuantity: number;
        checkIns: number;
        checkOuts: number;
        activeEmployees: number;
      }>;
      employee: Array<{
        id: string;
        label: string;
        checkIns: number;
        checkOuts: number;
        stores: string[];
      }>;
    };
    metadata: {
      lookbackDays: number;
      timeZone: string;
      generatedAt: string;
    };
  };
  attendance: {
    totalCheckIns: number;
    activeEmployees: number;
  };
  sales: {
    dailyTrend: Array<{
      total: number;
      quantity: number;
      display: string;
    }>;
    topProducts: Array<{
      name: string;
      total: number;
      quantity: number;
    }>;
    totalRevenue: number;
    totalQuantity: number;
  };
  updatedAt: string;
};

type SimplifiedEmployee = {
  id: string;
  name: string;
  province: string | null;
};

type SimplifiedStore = {
  id: string;
  name: string;
  province: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

type EnterpriseDashboardClientProps = {
  snapshot: DashboardSnapshot;
  initialMetrics: DashboardMetrics;
  employees: SimplifiedEmployee[];
  stores: SimplifiedStore[];
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("th-TH");

export default function EnterpriseDashboardClient({
  snapshot,
  initialMetrics,
  stores,
}: EnterpriseDashboardClientProps) {
  const [metrics] = useState<DashboardMetrics>(initialMetrics);
  const [realtimeRevenue] = useState(snapshot.kpis.sales.value);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [showRealtimeNotification, setShowRealtimeNotification] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const router = useRouter();

  // Refetch dashboard data when realtime event occurs
  const refetchDashboard = useCallback(async () => {
    try {
      // Show notification
      setShowRealtimeNotification(true);
      setTimeout(() => setShowRealtimeNotification(false), 3000);

      // Refresh the page data using Next.js router
      router.refresh();

      setLastUpdate(new Date());
    } catch (error) {
      console.error('[Dashboard] Failed to refetch:', error);
    }
  }, [router]);

  // Try Supabase Realtime first, fallback to polling
  const { isConnected } = useSupabaseRealtime({
    onSalesInsert: refetchDashboard,
    onAttendanceInsert: refetchDashboard,
    enabled: true,
  });

  // ✅ Fallback: Polling every 30 seconds if Realtime is not connected
  // (Realtime requires Supabase Pro plan, so we use polling for Free tier)
  // Changed from 10s to 30s to reduce server load (still responsive for dashboard)
  useEffect(() => {
    if (isConnected) {
      console.log('[Dashboard] Using Supabase Realtime ⚡');
      return; // Don't use polling if Realtime is connected
    }

    console.log('[Dashboard] Realtime not available, using polling fallback (30s) 🔄');
    const interval = setInterval(() => {
      console.log('[Dashboard] Polling for updates...');
      router.refresh();
      setLastUpdate(new Date());
    }, 30000); // Poll every 30 seconds (balanced updates vs server load)

    return () => clearInterval(interval);
  }, [isConnected, router]);

  // Calculate seconds since last update
  const secondsSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);

  // Format delta
  const formatDelta = (delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) {
      return { label: "0%", tone: "neutral" as const };
    }
    return {
      label: `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`,
      tone: delta > 0 ? "up" : "down",
    };
  };

  // Smart alerts based on actual data
  const smartAlerts = useMemo(() => {
    const alerts: Array<{ type: 'critical' | 'warning' | 'info'; message: string }> = [];

    // Check sales performance
    if (snapshot.kpis.sales.deltaPercent < -10) {
      alerts.push({
        type: 'critical',
        message: `ยอดขายลดลง ${Math.abs(snapshot.kpis.sales.deltaPercent).toFixed(1)}% เทียบกับช่วงก่อน - ต้องตรวจสอบด่วน`
      });
    } else if (snapshot.kpis.sales.deltaPercent > 20) {
      alerts.push({
        type: 'info',
        message: `ยอดขายเพิ่มขึ้น ${snapshot.kpis.sales.deltaPercent.toFixed(1)}% - โอกาสเพิ่ม stock`
      });
    }

    // Check attendance
    if (snapshot.kpis.attendance.deltaPercent < -15) {
      alerts.push({
        type: 'warning',
        message: `การเช็กอินลดลง ${Math.abs(snapshot.kpis.attendance.deltaPercent).toFixed(1)}% - ติดตามทีม`
      });
    }

    // Check store performance
    const worstStore = snapshot.performance.segments.store
      .slice()
      .sort((a, b) => a.salesTotal - b.salesTotal)[0];

    if (worstStore && worstStore.salesTotal < snapshot.kpis.sales.value * 0.05) {
      alerts.push({
        type: 'warning',
        message: `ร้าน "${worstStore.label}" มียอดขายต่ำ - แนะนำตรวจสอบทีม`
      });
    }

    return alerts;
  }, [snapshot]);

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-sky-50/20 pb-12">
      {/* Realtime Update Notification */}
      {showRealtimeNotification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">ข้อมูลอัปเดตแล้ว</p>
                <p className="text-xs text-emerald-700">Dashboard รีเฟรชสำเร็จ</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <div className="sticky top-0 z-20 border-b border-blue-100 bg-white/85 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Enterprise Dashboard</h1>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500">Real-time Business Intelligence</p>
                {isConnected ? (
                  <div className="flex items-center gap-1 text-emerald-600">
                    <Wifi className="h-3 w-3" />
                    <span className="text-xs font-semibold">Live</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-slate-400">
                    <WifiOff className="h-3 w-3" />
                    <span className="text-xs">Offline</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
              >
                พิมพ์รายงาน
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* HERO: Real-Time Revenue Counter */}
        <section className="relative overflow-hidden rounded-3xl border-2 border-blue-200 bg-gradient-to-br from-white via-sky-50/40 to-blue-50/30 p-6 sm:p-8 md:p-12 shadow-[0_40px_120px_-30px_rgba(59,130,246,0.3)] lg:backdrop-blur-sm">
          {/* Glow Effect */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(45% 55% at 50% 0%, rgba(147, 197, 253, 0.28), transparent)
                `,
              }}
            />
          </div>

          {/* Live Indicator */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 sm:px-4 sm:py-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">LIVE</span>
          </div>

          {/* Main Content */}
          <div className="relative z-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 sm:px-4 sm:py-2 mb-3 sm:mb-4">
              <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-blue-600">
                Total Revenue (All Time)
              </span>
            </div>

            {/* MASSIVE Number - Responsive */}
            <div className="my-4 sm:my-6">
              <AnimatedRevenue value={realtimeRevenue} />
            </div>

            {/* Growth Indicator */}
            <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap">
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 ${
                snapshot.kpis.sales.deltaPercent > 0
                  ? 'bg-emerald-100'
                  : 'bg-rose-100'
              }`}>
                {snapshot.kpis.sales.deltaPercent > 0 ? (
                  <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
                ) : (
                  <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 text-rose-600" />
                )}
                <span className={`text-xs sm:text-sm font-bold ${
                  snapshot.kpis.sales.deltaPercent > 0
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }`}>
                  {formatDelta(snapshot.kpis.sales.deltaPercent).label}
                </span>
              </div>
              <span className="text-xs sm:text-sm text-slate-500">vs ช่วงก่อนหน้า</span>
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-400">
                <Clock className="h-3 w-3" />
                <span className="hidden sm:inline">อัปเดตล่าสุด {secondsSinceUpdate} วินาทีที่แล้ว</span>
                <span className="sm:hidden">{secondsSinceUpdate}s ago</span>
              </div>
            </div>
          </div>
        </section>

        {/* Executive Summary + AI Insights */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Executive Summary */}
          <ExecutiveSummaryCard snapshot={snapshot} />

          {/* Smart Alerts Panel */}
          <SmartAlertsPanel alerts={smartAlerts} />
        </div>

        {/* Quick Stats Cards */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <QuickStatCard
            icon={<ShoppingCart className="h-6 w-6" />}
            label="ธุรกรรม"
            value={numberFormatter.format(snapshot.kpis.salesTransactions.value)}
            delta={snapshot.kpis.salesTransactions.deltaPercent}
            color="blue"
          />
          <QuickStatCard
            icon={<Users className="h-6 w-6" />}
            label="เช็กอิน"
            value={numberFormatter.format(snapshot.kpis.attendance.value)}
            delta={snapshot.kpis.attendance.deltaPercent}
            color="emerald"
          />
          <QuickStatCard
            icon={<Activity className="h-6 w-6" />}
            label="Avg Ticket"
            value={currencyFormatter.format(snapshot.kpis.averageTicket.value)}
            delta={snapshot.kpis.averageTicket.deltaPercent}
            color="indigo"
          />
          <QuickStatCard
            icon={<MapPin className="h-6 w-6" />}
            label="ร้านค้าทั้งหมด"
            value={numberFormatter.format(snapshot.totals.stores)}
            delta={0}
            color="sky"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-[1fr_1.5fr]">
          {/* Left: Quick Stats Detail + Store Performance List */}
          <div className="space-y-4 sm:space-y-6">
            {/* Summary Stats */}
            <div className="rounded-3xl border-2 border-blue-100 bg-white p-4 sm:p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900 mb-4">สรุปข้อมูลรวม</h3>
              <dl className="space-y-4">
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-slate-600">พนักงานทั้งหมด</dt>
                  <dd className="text-lg font-bold text-slate-900">
                    {numberFormatter.format(snapshot.totals.employees)} คน
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-slate-600">พนักงานที่ active</dt>
                  <dd className="text-lg font-bold text-emerald-600">
                    {numberFormatter.format(snapshot.attendance.activeEmployees)} คน
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-slate-600">จำนวนสินค้า</dt>
                  <dd className="text-lg font-bold text-slate-900">
                    {numberFormatter.format(snapshot.totals.products)} รายการ
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-slate-600">ยอดขายรวม</dt>
                  <dd className="text-lg font-bold text-blue-600">
                    {currencyFormatter.format(snapshot.sales.totalRevenue)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Store Performance List */}
            <StorePerformanceList
              stores={stores.map(store => ({
                id: store.id,
                name: store.name,
                province: store.province || 'ไม่ระบุจังหวัด',
                sales: snapshot.performance.segments.store.find(s => s.label === store.name)?.salesTotal || 0,
                transactions: snapshot.performance.segments.store.find(s => s.label === store.name)?.salesCount || 0,
              }))}
              selectedStoreId={selectedStoreId}
              onStoreSelect={setSelectedStoreId}
            />
          </div>

          {/* Right: Thailand Store Map */}
          <ThailandStoreMap
            stores={stores.map(store => ({
              id: store.id,
              name: store.name,
              province: store.province || 'ไม่ระบุจังหวัด',
              lat: store.latitude || 13.7563,
              lng: store.longitude || 100.5018,
              sales: snapshot.performance.segments.store.find(s => s.label === store.name)?.salesTotal || 0,
              transactions: snapshot.performance.segments.store.find(s => s.label === store.name)?.salesCount || 0,
            }))}
            selectedStoreId={selectedStoreId}
            onStoreSelect={setSelectedStoreId}
          />
        </div>

        {/* Revenue Stream Chart */}
        <RevenueStreamChart metrics={metrics} />

        {/* Three Columns: Top Performers, Recent Activities, Top Products */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <TopPerformersCard data={snapshot.performance.segments.employee.slice(0, 5)} />
          <TopProductsCard products={snapshot.sales.topProducts.slice(0, 5)} />
          <RecentActivitiesCard activities={snapshot.kpis.alerts} />
        </div>
      </div>
    </div>
  );
}

// Animated Revenue Component - Responsive
function AnimatedRevenue({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value === prevValue.current) return;

    const start = prevValue.current;
    const end = value;
    const duration = 1000;
    const steps = 60;
    const increment = (end - start) / steps;

    let current = 0;
    const timer = setInterval(() => {
      current++;
      setDisplayValue(start + (increment * current));
      if (current >= steps) {
        clearInterval(timer);
        prevValue.current = value;
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400">
      {currencyFormatter.format(Math.round(displayValue))}
    </span>
  );
}

// Executive Summary Card
const ExecutiveSummaryCard = memo(function ExecutiveSummaryCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="rounded-3xl border-2 border-blue-100 bg-gradient-to-br from-white to-blue-50/30 p-4 sm:p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-sky-400 p-3">
          <BarChart3 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Executive Summary</h3>
          <p className="text-xs text-slate-500">ภาพรวมสำหรับผู้บริหาร</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-900">Sales Performance</p>
            <p className="text-emerald-700">
              {snapshot.kpis.sales.deltaPercent > 0 ? 'เติบโต' : 'ลดลง'} {Math.abs(snapshot.kpis.sales.deltaPercent).toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <Users className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-blue-900">พนักงาน Active</p>
            <p className="text-blue-700">
              {snapshot.attendance.activeEmployees}/{snapshot.totals.employees} คน
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <MapPin className="h-5 w-5 text-indigo-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-indigo-900">Top Store</p>
            <p className="text-indigo-700">
              {snapshot.performance.segments.store[0]?.label || '-'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Overall Status</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            GOOD ✨
          </span>
        </div>
      </div>
    </div>
  );
});

// Smart Alerts Panel
const SmartAlertsPanel = memo(function SmartAlertsPanel({
  alerts
}: {
  alerts: Array<{ type: 'critical' | 'warning' | 'info'; message: string }>
}) {
  return (
    <div className="rounded-3xl border-2 border-amber-100 bg-gradient-to-br from-white to-amber-50/30 p-4 sm:p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 p-3">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Smart Insights</h3>
          <p className="text-xs text-slate-500">AI-Powered Business Intelligence</p>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-emerald-900">ทุกอย่างเป็นไปด้วยดี</p>
          <p className="text-xs text-emerald-700 mt-1">ไม่มีประเด็นที่ต้องเร่งแก้ไข</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`rounded-xl border p-3 flex items-start gap-3 ${
                alert.type === 'critical'
                  ? 'border-rose-200 bg-rose-50'
                  : alert.type === 'warning'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-blue-200 bg-blue-50'
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 flex-shrink-0 ${
                  alert.type === 'critical'
                    ? 'text-rose-600'
                    : alert.type === 'warning'
                    ? 'text-amber-600'
                    : 'text-blue-600'
                }`}
              />
              <p
                className={`text-sm ${
                  alert.type === 'critical'
                    ? 'text-rose-900'
                    : alert.type === 'warning'
                    ? 'text-amber-900'
                    : 'text-blue-900'
                }`}
              >
                {alert.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// Quick Stat Card
const QuickStatCard = memo(function QuickStatCard({
  icon,
  label,
  value,
  delta,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: number;
  color: string;
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-sky-400',
    emerald: 'from-emerald-500 to-teal-400',
    indigo: 'from-indigo-500 to-purple-400',
    sky: 'from-sky-500 to-cyan-400',
  };

  return (
    <div className="rounded-3xl border-2 border-blue-100 bg-white p-4 sm:p-6 shadow-xl hover:shadow-2xl transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`rounded-2xl bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} p-2 sm:p-3 text-white`}>
          {icon}
        </div>
      </div>
      <p className="text-xs sm:text-sm font-semibold text-slate-600 mb-1 truncate">{label}</p>
      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 mb-2 truncate">{value}</p>
      {delta !== 0 && (
        <div className="flex items-center gap-1">
          {delta > 0 ? (
            <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" />
          ) : (
            <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 text-rose-600" />
          )}
          <span className={`text-xs sm:text-sm font-semibold ${delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {Math.abs(delta).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if value or delta changes
  return prevProps.value === nextProps.value && prevProps.delta === nextProps.delta;
});

// Skeleton Components
function MapSkeleton() {
  return (
    <div className="rounded-3xl border-2 border-blue-100 bg-white p-6 shadow-xl">
      <div className="h-8 w-48 bg-slate-200 rounded-lg mb-4 animate-pulse" />
      <div className="h-[500px] bg-slate-200 rounded-2xl animate-pulse" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-3xl border-2 border-blue-100 bg-white p-6 shadow-xl">
      <div className="h-8 w-64 bg-slate-200 rounded-lg mb-4 animate-pulse" />
      <div className="h-80 bg-slate-200 rounded-2xl animate-pulse" />
    </div>
  );
}

// Store Performance List Component
const StorePerformanceList = memo(function StorePerformanceList({
  stores,
  selectedStoreId,
  onStoreSelect,
}: {
  stores: Array<{ id: string; name: string; province: string; sales: number; transactions: number }>;
  selectedStoreId: string | null;
  onStoreSelect: (storeId: string) => void;
}) {
  // Sort stores by sales (descending) - memoized
  const sortedStores = useMemo(() =>
    [...stores].sort((a, b) => b.sales - a.sales),
    [stores]
  );

  // Get performance level
  const getPerformanceLevel = (sales: number) => {
    if (sales > 500000) return { color: 'emerald', label: '⭐⭐⭐' };
    if (sales > 200000) return { color: 'blue', label: '⭐⭐' };
    if (sales > 100000) return { color: 'amber', label: '⭐' };
    return { color: 'slate', label: '' };
  };

  return (
    <div className="rounded-3xl border-2 border-blue-100 bg-white p-4 sm:p-6 shadow-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">Performance by Store</h3>
          <p className="text-xs text-slate-500">คลิกเพื่อดูตำแหน่งบนแผนที่</p>
        </div>
        <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 w-fit">
          {sortedStores.length} ร้าน
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        {sortedStores.map((store, index) => {
          const performance = getPerformanceLevel(store.sales);
          const isSelected = selectedStoreId === store.id;

          return (
            <button
              key={store.id}
              type="button"
              onClick={() => onStoreSelect(store.id)}
              className={`w-full text-left rounded-xl border-2 p-3 transition-all duration-200 ${
                isSelected
                  ? 'border-blue-400 bg-blue-50 shadow-lg scale-[1.02]'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md hover:scale-[1.01]'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Rank Badge */}
                <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                  index === 0
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-md'
                    : index === 1
                    ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-md'
                    : index === 2
                    ? 'bg-gradient-to-br from-orange-300 to-amber-400 text-white shadow-md'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {index + 1}
                </div>

                {/* Store Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`font-semibold truncate ${
                      isSelected ? 'text-blue-900' : 'text-slate-900'
                    }`}>
                      {store.name}
                    </p>
                    {performance.label && (
                      <span className="text-xs">{performance.label}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{store.province}</p>

                  {/* Sales & Transactions */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-blue-500" />
                      <span className={`font-bold ${
                        performance.color === 'emerald' ? 'text-emerald-600' :
                        performance.color === 'blue' ? 'text-blue-600' :
                        performance.color === 'amber' ? 'text-amber-600' : 'text-slate-600'
                      }`}>
                        {currencyFormatter.format(store.sales)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500">
                      <ShoppingCart className="h-3 w-3" />
                      <span>{numberFormatter.format(store.transactions)} รายการ</span>
                    </div>
                  </div>
                </div>

                {/* Arrow Indicator */}
                {isSelected && (
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

// Top Performers Card
const TopPerformersCard = memo(function TopPerformersCard({ data }: { data: Array<{ id: string; label: string; checkIns: number; checkOuts: number; stores: string[] }> }) {
  return (
    <div className="rounded-3xl border-2 border-blue-100 bg-white p-4 sm:p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 p-3">
          <TrendingUp className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Top Performers</h3>
          <p className="text-xs text-slate-500">พนักงานที่มีผลงานโดดเด่น</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <Users className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600">ยังไม่มีข้อมูลพนักงาน</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((employee, index) => (
            <div
              key={employee.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-3 hover:border-blue-200 hover:shadow-md transition"
            >
              <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                index === 0
                  ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white'
                  : index === 1
                  ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white'
                  : index === 2
                  ? 'bg-gradient-to-br from-orange-300 to-amber-400 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{employee.label}</p>
                <p className="text-xs text-slate-500">
                  {employee.checkIns} เช็กอิน · {employee.stores.length} ร้าน
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">{employee.checkIns + employee.checkOuts}</p>
                  <p className="text-xs text-slate-500">ครั้ง</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// Top Products Card
const TopProductsCard = memo(function TopProductsCard({ products }: { products: Array<{ name: string; total: number; quantity: number }> }) {
  return (
    <div className="rounded-3xl border-2 border-blue-100 bg-white p-4 sm:p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-400 p-3">
          <ShoppingCart className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Top Products</h3>
          <p className="text-xs text-slate-500">สินค้าขายดี</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
          <ShoppingCart className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600">ยังไม่มีข้อมูลสินค้า</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div
              key={product.name}
              className="rounded-xl border border-slate-200 bg-gradient-to-r from-indigo-50/50 to-white p-3 hover:border-indigo-200 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 mb-1 truncate">{product.name}</p>
                  <p className="text-xs text-slate-500">
                    ขายได้ {numberFormatter.format(product.quantity)} ชิ้น
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-bold text-indigo-600">
                    {currencyFormatter.format(product.total)}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400"
                  style={{
                    width: `${Math.min((product.quantity / (products[0]?.quantity || 1)) * 100, 100)}%`
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// Recent Activities Card
const RecentActivitiesCard = memo(function RecentActivitiesCard({ activities }: { activities: string[] }) {
  return (
    <div className="rounded-3xl border-2 border-blue-100 bg-white p-4 sm:p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 p-3">
          <Activity className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">System Alerts</h3>
          <p className="text-xs text-slate-500">การแจ้งเตือนระบบ</p>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-emerald-900">ไม่มีการแจ้งเตือน</p>
          <p className="text-xs text-emerald-700 mt-1">ระบบทำงานปกติ</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((activity, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 flex-1">{activity}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <button
          type="button"
          className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-100 transition"
        >
          ดูกิจกรรมทั้งหมด →
        </button>
      </div>
    </div>
  );
});
