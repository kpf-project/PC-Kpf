"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { EmployeeRecord } from "@/lib/supabaseDirectory";
import { useAuth } from "@/contexts/AuthContext";

type SwapType = "regular-day-off" | "public-holiday";
type SwapStatus = "pending" | "approved" | "rejected" | "cancelled";

interface DayOffSwap {
  id: string;
  employeeId: string;
  workOnDate: string;
  offOnDate: string;
  swapType: SwapType;
  originalSchedule: string | null;
  reason: string | null;
  status: SwapStatus;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

const SWAP_TYPE_OPTIONS: Array<{ value: SwapType; label: string }> = [
  { value: "regular-day-off", label: "วันหยุดประจำ (เช่น วันอาทิตย์)" },
  { value: "public-holiday", label: "วันหยุดนักขัตฤกษ์" },
];

const SWAP_STATUS_OPTIONS: Array<{ value: SwapStatus; label: string; color: string }> = [
  { value: "pending", label: "รอพิจารณา", color: "text-amber-600 bg-amber-50" },
  { value: "approved", label: "อนุมัติแล้ว", color: "text-emerald-600 bg-emerald-50" },
  { value: "rejected", label: "ไม่อนุมัติ", color: "text-red-600 bg-red-50" },
  { value: "cancelled", label: "ยกเลิก", color: "text-slate-500 bg-slate-50" },
];

type SwapFormState = {
  employeeId: string;
  workOnDate: string;
  offOnDate: string;
  swapType: SwapType;
  originalSchedule: string;
  reason: string;
};

const EMPTY_SWAP_FORM: SwapFormState = {
  employeeId: "",
  workOnDate: "",
  offOnDate: "",
  swapType: "regular-day-off",
  originalSchedule: "",
  reason: "",
};

export default function DayOffSwapsPage() {
  // Get authenticated user for permission checks
  const { user } = useAuth();

  const [employees, setEmployees] = useState<Array<Pick<EmployeeRecord, "id" | "name">>>([]);
  const [swaps, setSwaps] = useState<DayOffSwap[]>([]);
  const [formState, setFormState] = useState<SwapFormState>(EMPTY_SWAP_FORM);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<SwapStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Permission checks
  const isEmployee = user?.role === "employee";
  const isSales = user?.role === "sales";
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  // Employee: can create and see only their own swaps
  // Sales: can see all swaps but read-only
  // Admin/Super_Admin: full access
  const canCreate = isEmployee || isAdmin;
  const canEdit = isAdmin;
  const canDelete = isAdmin;

  const refreshEmployees = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/employees");
      if (!response.ok) throw new Error("ไม่สามารถโหลดรายชื่อพนักงานได้");
      const data = (await response.json()) as { employees?: Array<EmployeeRecord> };
      const list =
        Array.isArray(data.employees)
          ? data.employees.map((employee) => ({ id: employee.id, name: employee.name }))
          : [];
      setEmployees(list);

      // For employee role, pre-select their own ID in form
      if (list.length > 0 && !formState.employeeId) {
        const defaultEmployeeId = isEmployee && user?.employeeId
          ? user.employeeId
          : list[0]!.id;
        setFormState((prev) => ({
          ...prev,
          employeeId: defaultEmployeeId,
        }));
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ไม่สามารถโหลดรายชื่อพนักงานได้";
      setError(message);
      setEmployees([]);
    }
  }, [formState.employeeId, isEmployee, user?.employeeId]);

  const refreshSwaps = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/day-off-swaps");
      if (!response.ok) throw new Error("ไม่สามารถโหลดข้อมูลการสลับวันหยุดได้");
      const data = (await response.json()) as { ok?: boolean; swaps?: DayOffSwap[] };
      setSwaps(Array.isArray(data.swaps) ? data.swaps : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลการสลับวันหยุดได้";
      setError(message);
      setSwaps([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([refreshEmployees(), refreshSwaps()]);
  }, [refreshEmployees, refreshSwaps]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleCreate = async () => {
    if (!formState.employeeId) {
      setError("กรุณาเลือกพนักงาน");
      return;
    }
    if (!formState.workOnDate || !formState.offOnDate) {
      setError("กรุณาระบุวันที่มาทำงานและวันที่หยุดแทน");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/day-off-swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formState,
          originalSchedule: formState.originalSchedule.trim() || null,
          reason: formState.reason.trim() || null,
          status: "pending",
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถบันทึกการสลับวันหยุดได้");
      }
      setFormState((prev) => ({
        ...EMPTY_SWAP_FORM,
        employeeId: prev.employeeId,
        swapType: prev.swapType,
      }));
      setSuccessMessage("บันทึกการสลับวันหยุดเรียบร้อย");
      await refreshSwaps();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ไม่สามารถบันทึกการสลับวันหยุดได้";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusUpdate = async (swapId: string, status: SwapStatus) => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/day-off-swaps/${swapId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถอัปเดตสถานะได้");
      }
      setSuccessMessage("อัปเดตสถานะเรียบร้อย");
      await refreshSwaps();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ไม่สามารถอัปเดตสถานะได้";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (swapId: string) => {
    if (!window.confirm("ต้องการลบรายการการสลับวันหยุดนี้หรือไม่?")) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/day-off-swaps/${swapId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถลบการสลับวันหยุดได้");
      }
      setSuccessMessage("ลบรายการเรียบร้อย");
      await refreshSwaps();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ไม่สามารถลบการสลับวันหยุดได้";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSwaps = useMemo(() => {
    let result = swaps;

    // Employee role: only see their own swaps (force filter)
    if (isEmployee && user?.employeeId) {
      result = result.filter((swap) => swap.employeeId === user.employeeId);
    } else {
      // Sales/Admin: can filter by employee
      if (filterEmployeeId !== "all") {
        result = result.filter((swap) => swap.employeeId === filterEmployeeId);
      }
    }

    if (filterStatus !== "all") {
      result = result.filter((swap) => swap.status === filterStatus);
    }
    return result;
  }, [filterEmployeeId, filterStatus, swaps, isEmployee, user?.employeeId]);

  const formatDate = (value: string) => {
    try {
      return new Date(value + "T00:00:00Z").toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        weekday: "short",
      });
    } catch {
      return value;
    }
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find((emp) => emp.id === employeeId);
    return employee?.name ?? "ไม่ระบุ";
  };

  const getStatusConfig = (status: SwapStatus) => {
    return SWAP_STATUS_OPTIONS.find((opt) => opt.value === status) ?? SWAP_STATUS_OPTIONS[0]!;
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900">จัดการสลับวันหยุด</h1>
        <p className="text-sm text-slate-500">
          จัดการการสลับวันหยุดประจำหรือวันหยุดนักขัตฤกษ์กับวันทำงาน พร้อมติดตามสถานะการอนุมัติ
        </p>
        {isSales && (
          <div className="rounded-3xl border border-blue-100 bg-blue-50/80 px-4 py-2 text-sm text-blue-700">
            ℹ️ คุณกำลังดูในโหมดอ่านอย่างเดียว (Read-Only) ไม่สามารถแก้ไขข้อมูลได้
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-3xl border border-red-100 bg-red-50/90 px-5 py-3 text-sm text-red-600 shadow-inner">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 px-5 py-3 text-sm text-emerald-600 shadow-inner">
          {successMessage}
        </div>
      )}

      {/* Form Section - Only show for Employee and Admin */}
      {canCreate && (
        <section className="rounded-3xl border border-blue-100 bg-white/85 p-5 shadow-inner shadow-blue-100/50">
          <h2 className="text-sm font-semibold text-slate-800">
            บันทึกการสลับวันหยุดใหม่
          </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600">
              พนักงาน *
            </label>
            <select
              value={formState.employeeId}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  employeeId: event.target.value,
                }))
              }
              disabled={isEmployee} // Employee cannot change employee selection
              className="mt-1 form-input"
            >
              {employees.length === 0 ? (
                <option value="">ยังไม่มีรายชื่อพนักงาน</option>
              ) : null}
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">
              ประเภทการสลับ *
            </label>
            <select
              value={formState.swapType}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  swapType: event.target.value as SwapType,
                }))
              }
              className="mt-1 form-input"
            >
              {SWAP_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">
              ตารางเดิม (เช่น &quot;วันอาทิตย์&quot;, &quot;วันขึ้นปีใหม่&quot;)
            </label>
            <input
              type="text"
              value={formState.originalSchedule}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  originalSchedule: event.target.value,
                }))
              }
              placeholder="ระบุตารางวันหยุดเดิม"
              className="mt-1 form-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">
              วันที่จะมาทำงาน * (ปกติเป็นวันหยุด)
            </label>
            <input
              type="date"
              value={formState.workOnDate}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  workOnDate: event.target.value,
                }))
              }
              className="mt-1 form-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">
              วันที่จะหยุดแทน * (ปกติเป็นวันทำงาน)
            </label>
            <input
              type="date"
              value={formState.offOnDate}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  offOnDate: event.target.value,
                }))
              }
              className="mt-1 form-input"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">
              เหตุผล (ถ้ามี)
            </label>
            <input
              type="text"
              value={formState.reason}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  reason: event.target.value,
                }))
              }
              placeholder="ระบุเหตุผล"
              className="mt-1 form-input"
            />
          </div>
        </div>

          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isSaving}
            className="mt-4 rounded-full bg-blue-600 px-8 py-2 text-sm font-medium text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </section>
      )}

      {/* Filter Section */}
      <section className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-inner shadow-slate-100/50">
        <div className="flex flex-wrap gap-3">
          {/* Only show employee filter for Sales/Admin (Employee sees their own data only) */}
          {!isEmployee && (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                กรองตามพนักงาน
              </label>
              <select
                value={filterEmployeeId}
                onChange={(event) => setFilterEmployeeId(event.target.value)}
                className="form-input text-sm"
              >
                <option value="all">ทุกคน</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              กรองตามสถานะ
            </label>
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value as SwapStatus | "all")}
              className="form-input text-sm"
            >
              <option value="all">ทุกสถานะ</option>
              {SWAP_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Swaps List Section */}
      <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-inner shadow-slate-100/50">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">
          รายการสลับวันหยุด ({filteredSwaps.length} รายการ)
        </h2>

        {isLoading ? (
          <div className="text-center py-8 text-slate-500">กำลังโหลด...</div>
        ) : filteredSwaps.length === 0 ? (
          <div className="text-center py-8 text-slate-500">ยังไม่มีรายการสลับวันหยุด</div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">พนักงาน</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">ประเภท</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">มาทำงาน</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">หยุดแทน</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">เหตุผล</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">สถานะ</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-700">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredSwaps.map((swap) => {
                  const statusConfig = getStatusConfig(swap.status);
                  return (
                    <tr key={swap.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-3 py-3 text-slate-800 font-medium">
                        {getEmployeeName(swap.employeeId)}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {swap.swapType === "regular-day-off" ? "วันหยุดประจำ" : "วันหยุดนักขัตฤกษ์"}
                      </td>
                      <td className="px-3 py-3 text-slate-800">
                        {formatDate(swap.workOnDate)}
                      </td>
                      <td className="px-3 py-3 text-slate-800">
                        {formatDate(swap.offOnDate)}
                      </td>
                      <td className="px-3 py-3 text-slate-600 max-w-xs truncate">
                        {swap.reason || "-"}
                      </td>
                      <td className="px-3 py-3">
                        {canEdit ? (
                          <select
                            value={swap.status}
                            onChange={(event) =>
                              void handleStatusUpdate(swap.id, event.target.value as SwapStatus)
                            }
                            disabled={isSaving}
                            className={`form-input text-xs py-1 px-2 rounded-full border-0 ${statusConfig.color}`}
                          >
                            {SWAP_STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-block text-xs py-1 px-3 rounded-full ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => void handleDelete(swap.id)}
                            disabled={isSaving}
                            className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                          >
                            ลบ
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
