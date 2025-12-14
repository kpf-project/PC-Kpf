"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { AppLogRow, LogScope } from "@/lib/supabaseLogs";

// UI-friendly log type that maps database fields to display fields
type DisplayLog = {
  id: string;
  timestamp: string;
  message: string; // maps to details
  scope: string;
  action: string;
  userName?: string | null; // maps to actor_name
  userRole?: string | null;
  ipAddress?: string | null;
  device?: string | null;
  browser?: string | null;
  location?: string | null;
  meta?: Record<string, unknown> | null; // maps to metadata
};

function mapLogToDisplay(log: AppLogRow): DisplayLog {
  const metadata = log.metadata as Record<string, unknown> | null;
  return {
    id: log.id,
    timestamp: log.timestamp,
    message: log.details ?? '',
    scope: log.scope,
    action: log.action,
    userName: log.actor_name,
    userRole: metadata?.userRole as string | undefined,
    ipAddress: metadata?.ipAddress as string | undefined,
    device: metadata?.device as string | undefined,
    browser: metadata?.browser as string | undefined,
    location: metadata?.location as string | undefined,
    meta: metadata,
  };
}
import { MapPin } from "lucide-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";

const SCOPE_OPTIONS: Array<{ label: string; value: "all" | LogScope }> = [
  { label: "ทั้งหมด", value: "all" },
  { label: "Attendance", value: "attendance" },
  { label: "Sales", value: "sales" },
  { label: "Employees", value: "employee" },
  { label: "Products", value: "product" },
  { label: "System", value: "system" },
];

type BackupFile = {
  name: string;
  timestamp: string;
  timestampFormatted: string;
};

type BackupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: BackupFile[] }
  | { status: "error"; message: string };

export default function LogsPage() {
  const queryClient = useQueryClient();

  // Logs state
  const [logs, setLogs] = useState<DisplayLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<"all" | LogScope>("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const LOGS_PER_PAGE = 20;

  // GPS state
  const [isGPSEnabled, setIsGPSEnabled] = useState(true);
  const [isSavingGPS, setIsSavingGPS] = useState(false);
  const [gpsSuccessMessage, setGPSSuccessMessage] = useState<string | null>(null);
  const [gpsErrorMessage, setGPSErrorMessage] = useState<string | null>(null);

  // Backups state (used in fetchBackups callback)
  const [, setBackupState] = useState<BackupState>({ status: "idle" });

  // Fetch logs
  useEffect(() => {
    void refreshLogs();
  }, []);

  const refreshLogs = async () => {
    setIsLoadingLogs(true);
    setLogsError(null);
    try {
      const response = await fetch("/api/admin/logs?limit=100");
      if (!response.ok) {
        throw new Error("ไม่สามารถโหลด Logs ได้");
      }
      const data = (await response.json()) as { logs: AppLogRow[] };
      const mappedLogs = (data.logs ?? []).map(mapLogToDisplay);
      setLogs(mappedLogs);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ไม่สามารถโหลด Logs ได้";
      setLogsError(message);
      setLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (scopeFilter === "all") return logs;
    return logs.filter((log) => log.scope === scopeFilter);
  }, [logs, scopeFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE);
  const startIndex = (currentPage - 1) * LOGS_PER_PAGE;
  const endIndex = startIndex + LOGS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [scopeFilter]);

  // Fetch GPS settings
  const { data: gpsSettings, isLoading: isLoadingGPS } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json() as Promise<{ gps_required?: boolean }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (gpsSettings && gpsSettings.gps_required !== undefined) {
      setIsGPSEnabled(gpsSettings.gps_required);
    }
  }, [gpsSettings]);

  // Auto-dismiss GPS success message
  useEffect(() => {
    if (!gpsSuccessMessage) return;
    const timer = setTimeout(() => setGPSSuccessMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [gpsSuccessMessage]);

  // GPS save mutation
  const saveGPSMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "gps_required",
          value: enabled,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save setting");
      }
      return res.json();
    },
    onSuccess: () => {
      setGPSSuccessMessage("บันทึกการตั้งค่า GPS เรียบร้อย");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: Error) => {
      setGPSErrorMessage(error.message);
    },
  });

  const handleGPSToggle = () => {
    setIsGPSEnabled(!isGPSEnabled);
  };

  const handleGPSSave = async () => {
    setIsSavingGPS(true);
    setGPSErrorMessage(null);
    try {
      await saveGPSMutation.mutateAsync(isGPSEnabled);
    } finally {
      setIsSavingGPS(false);
    }
  };

  // Fetch backups
  const fetchBackups = useCallback(async () => {
    setBackupState({ status: "loading" });
    try {
      const response = await fetch("/api/admin/backups");
      const result = (await response.json()) as { ok: boolean; data: BackupFile[]; message?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "ไม่สามารถดึงรายการสำรองข้อมูลได้");
      }

      setBackupState({ status: "success", data: result.data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถดึงรายการสำรองข้อมูลได้";
      setBackupState({ status: "error", message });
    }
  }, []);

  useEffect(() => {
    void fetchBackups();
  }, [fetchBackups]);

  // Backup functionality moved to /admin/logs/backups
  // const handleRestore = async (backupName: string) => {
  //   ... (commented out - functionality moved)
  // };

  // const backupList = backupState.status === "success" ? backupState.data : [];
  // const isLoadingBackups = backupState.status === "loading";
  // const hasBackupError = backupState.status === "error";

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900">ระบบ Logs & การตั้งค่า</h1>
        <p className="text-sm text-slate-500">
          ตรวจสอบกิจกรรม, จัดการการใช้งาน GPS และสำรองข้อมูล
        </p>
      </header>

      {/* GPS Settings Section */}
      <section className="space-y-4 rounded-3xl border border-emerald-100 bg-white/90 p-5 shadow-[0_24px_90px_-60px_rgba(16,185,129,0.35)]">
        <div className="flex items-center gap-3 border-b border-emerald-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
            <MapPin className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">การใช้งาน GPS</h2>
            <p className="text-xs text-slate-500">
              กำหนดว่าจะบังคับให้ใช้พิกัด GPS ในการลงเวลาและบันทึกยอดขายหรือไม่
            </p>
          </div>
        </div>

        {isLoadingGPS ? (
          <div className="flex items-center justify-center py-8">
            <div className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-b-transparent" />
            <span className="ml-3 text-sm text-slate-500">กำลังโหลดการตั้งค่า...</span>
          </div>
        ) : (
          <>
            {gpsErrorMessage && (
              <div className="rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-600">
                {gpsErrorMessage}
              </div>
            )}

            {gpsSuccessMessage && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-600">
                {gpsSuccessMessage}
              </div>
            )}

            <div className="space-y-4 rounded-2xl border border-emerald-100 bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label htmlFor="gps-toggle" className="block text-sm font-semibold text-slate-700">
                    บังคับใช้ GPS
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    {isGPSEnabled
                      ? "พนักงานต้องเปิด GPS และอยู่ในพื้นที่กำหนดเพื่อลงเวลา"
                      : "พนักงานสามารถเลือกร้านค้าด้วยตนเองโดยไม่ต้องใช้ GPS"}
                  </p>
                </div>
                <button
                  type="button"
                  id="gps-toggle"
                  onClick={handleGPSToggle}
                  className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                    isGPSEnabled ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                  role="switch"
                  aria-checked={isGPSEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isGPSEnabled ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  📋 รายละเอียด
                </h4>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  <li className="flex gap-2">
                    <span className="text-emerald-500">•</span>
                    <span>
                      <strong>เปิด GPS:</strong> พนักงานต้องอยู่ในรัศมีที่กำหนดของร้านค้า
                      ระบบจะตรวจสอบตำแหน่งอัตโนมัติ
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-500">•</span>
                    <span>
                      <strong>ปิด GPS:</strong> พนักงานเลือกร้านค้าจาก dropdown
                      เหมาะสำหรับพื้นที่ที่ GPS ใช้งานไม่ได้
                    </span>
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleGPSSave}
                  disabled={isSavingGPS}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_20px_60px_-45px_rgba(16,185,129,1)] transition hover:shadow-[0_24px_70px_-50px_rgba(16,185,129,1)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingGPS ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
                </button>
              </div>
            </div>
          </>
        )}
      </section>


      {/* Logs Section */}
      <section className="space-y-4 rounded-3xl border border-blue-100 bg-white/90 p-5 shadow-[0_24px_90px_-60px_rgba(37,99,235,0.35)]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">ประวัติกิจกรรม (Logs)</h2>
          <button
            type="button"
            onClick={() => void refreshLogs()}
            className="inline-flex items-center rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_20px_60px_-45px_rgba(37,99,235,1)] transition hover:shadow-[0_24px_70px_-50px_rgba(37,99,235,1)]"
          >
            รีเฟรช
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={scopeFilter}
            onChange={(event) =>
              setScopeFilter(event.target.value as "all" | LogScope)
            }
            className="form-input max-w-[200px]"
          >
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {logsError && (
          <div className="rounded-3xl border border-red-100 bg-red-50/90 px-5 py-3 text-sm text-red-600 shadow-inner">
            {logsError}
          </div>
        )}

        {isLoadingLogs ? (
          <p className="text-sm text-slate-500">กำลังโหลดข้อมูล...</p>
        ) : filteredLogs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-blue-200 px-4 py-3 text-xs text-blue-500">
            ไม่พบข้อมูลในช่วงที่เลือก
          </p>
        ) : (
          <>
            {/* Desktop Table View (hidden on mobile) */}
            <div className="hidden overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm lg:block">
              <table className="w-full">
                <thead className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      เวลา
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      กิจกรรม
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      ผู้ใช้
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                      ข้อมูลเพิ่มเติม
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="transition hover:bg-blue-50/30">
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {new Date(log.timestamp).toLocaleString("th-TH", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{log.message}</p>
                        <p className="text-xs text-slate-500">
                          {log.scope} • {log.action}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {log.userName ? (
                          <div className="text-xs">
                            <p className="font-medium text-slate-900">{log.userName}</p>
                            <p className="text-slate-500">
                              {log.userRole ? `Role: ${log.userRole}` : "—"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1 text-xs text-slate-600">
                          {log.ipAddress && (
                            <p className="flex items-center gap-1">
                              <span className="font-medium">IP:</span> {log.ipAddress}
                            </p>
                          )}
                          {log.device && (
                            <p className="flex items-center gap-1">
                              <span className="font-medium">Device:</span> {log.device}
                            </p>
                          )}
                          {log.browser && (
                            <p className="flex items-center gap-1">
                              <span className="font-medium">Browser:</span> {log.browser}
                            </p>
                          )}
                          {log.location && (
                            <p className="flex items-center gap-1">
                              <span className="font-medium">Location:</span>{" "}
                              {typeof log.location === "string"
                                ? log.location
                                : typeof log.location === "object" &&
                                  log.location !== null &&
                                  "latitude" in log.location &&
                                  "longitude" in log.location
                                ? `${(log.location as { latitude: number; longitude: number }).latitude}, ${(log.location as { latitude: number; longitude: number }).longitude}`
                                : JSON.stringify(log.location)}
                            </p>
                          )}
                          {log.meta && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-blue-600 hover:text-blue-700">
                                Meta
                              </summary>
                              <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-xs">
                                {JSON.stringify(log.meta, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Card View (hidden on desktop) */}
            <div className="space-y-3 lg:hidden">
              {paginatedLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-blue-50 pb-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{log.message}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {log.scope} • {log.action}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                      {new Date(log.timestamp).toLocaleString("th-TH", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* User Info */}
                  {log.userName && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                        {log.userName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 text-xs">
                        <p className="font-medium text-slate-900">{log.userName}</p>
                        {log.userRole && (
                          <p className="text-slate-500">Role: {log.userRole}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Technical Details */}
                  {(log.ipAddress || log.device || log.browser || log.location) && (
                    <div className="mt-3 space-y-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                      {log.ipAddress && (
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-slate-700">IP:</span>
                          <span className="text-slate-600">{log.ipAddress}</span>
                        </div>
                      )}
                      {log.device && (
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-slate-700">Device:</span>
                          <span className="text-slate-600">{log.device}</span>
                        </div>
                      )}
                      {log.browser && (
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-slate-700">Browser:</span>
                          <span className="text-slate-600">{log.browser}</span>
                        </div>
                      )}
                      {log.location && (
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-slate-700">Location:</span>
                          <span className="text-slate-600">
                            {typeof log.location === "string"
                              ? log.location
                              : typeof log.location === "object" &&
                                log.location !== null &&
                                "latitude" in log.location &&
                                "longitude" in log.location
                              ? `${(log.location as { latitude: number; longitude: number }).latitude}, ${(log.location as { latitude: number; longitude: number }).longitude}`
                              : JSON.stringify(log.location)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Meta Details */}
                  {log.meta && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-blue-600">
                        📋 รายละเอียดเพิ่มเติม
                      </summary>
                      <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                        {JSON.stringify(log.meta, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
                {/* Page Info */}
                <div className="text-sm text-slate-600">
                  แสดง {startIndex + 1}-{Math.min(endIndex, filteredLogs.length)} จากทั้งหมด{" "}
                  {filteredLogs.length} รายการ
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
                  >
                    ← ก่อนหน้า
                  </button>

                  <div className="flex items-center gap-1">
                    {/* First Page */}
                    {currentPage > 2 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setCurrentPage(1)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-white text-sm font-medium text-slate-700 transition hover:bg-blue-50"
                        >
                          1
                        </button>
                        {currentPage > 3 && (
                          <span className="px-2 text-slate-400">...</span>
                        )}
                      </>
                    )}

                    {/* Current Page neighbors */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => Math.abs(page - currentPage) <= 1)
                      .map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition ${
                            page === currentPage
                              ? "border-blue-500 bg-blue-500 text-white"
                              : "border-blue-100 bg-white text-slate-700 hover:bg-blue-50"
                          }`}
                        >
                          {page}
                        </button>
                      ))}

                    {/* Last Page */}
                    {currentPage < totalPages - 1 && (
                      <>
                        {currentPage < totalPages - 2 && (
                          <span className="px-2 text-slate-400">...</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(totalPages)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-white text-sm font-medium text-slate-700 transition hover:bg-blue-50"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
                  >
                    ถัดไป →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
