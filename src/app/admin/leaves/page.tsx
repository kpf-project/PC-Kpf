"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmployeeRecord } from "@/lib/supabaseDirectory";
import type { LeaveRecord } from "@/lib/configStore";

const LEAVE_TYPE_OPTIONS = [
  "ลากิจ",
  "ลาป่วย",
  "ลาพักร้อน",
  "ลาอบรม/สัมมนา",
  "อื่นๆ",
];

const LEAVE_STATUS_OPTIONS: Array<{ value: LeaveRecord["status"]; label: string }> = [
  { value: "scheduled", label: "รอดำเนินการ" },
  { value: "approved", label: "อนุมัติแล้ว" },
  { value: "rejected", label: "ไม่อนุมัติ" },
  { value: "cancelled", label: "ยกเลิก" },
];

type LeaveFormState = {
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  note: string;
};

const EMPTY_LEAVE_FORM: LeaveFormState = {
  employeeId: "",
  type: LEAVE_TYPE_OPTIONS[0]!,
  startDate: "",
  endDate: "",
  reason: "",
  note: "",
};

export default function LeavesPage() {
  const [employees, setEmployees] = useState<Array<Pick<EmployeeRecord, "id" | "name">>>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [formState, setFormState] = useState<LeaveFormState>(EMPTY_LEAVE_FORM);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([refreshEmployees(), refreshLeaves()]);
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const refreshEmployees = async () => {
    try {
      const response = await fetch("/api/admin/employees");
      if (!response.ok) throw new Error("ไม่สามารถโหลดรายชื่อพนักงานได้");
      const data = (await response.json()) as { employees?: Array<EmployeeRecord> };
      const list =
        Array.isArray(data.employees)
          ? data.employees.map((employee) => ({ id: employee.id, name: employee.name }))
          : [];
      setEmployees(list);
      if (list.length > 0) {
        setFormState((prev) => ({
          ...prev,
          employeeId: prev.employeeId || list[0]!.id,
        }));
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ไม่สามารถโหลดรายชื่อพนักงานได้";
      setError(message);
      setEmployees([]);
    }
  };

  const refreshLeaves = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/leaves");
      if (!response.ok) throw new Error("ไม่สามารถโหลดข้อมูลวันลาได้");
      const data = (await response.json()) as { leaves?: LeaveRecord[] };
      setLeaves(Array.isArray(data.leaves) ? data.leaves : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลวันลาได้";
      setError(message);
      setLeaves([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formState.employeeId) {
      setError("กรุณาเลือกพนักงาน");
      return;
    }
    if (!formState.startDate || !formState.endDate) {
      setError("กรุณาระบุช่วงวันที่ลา");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formState,
          reason: formState.reason.trim(),
          note: formState.note.trim(),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถบันทึกวันลาได้");
      }
      setFormState((prev) => ({
        ...EMPTY_LEAVE_FORM,
        employeeId: prev.employeeId,
        type: prev.type,
      }));
      setSuccessMessage("บันทึกวันลาเรียบร้อย");
      await refreshLeaves();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ไม่สามารถบันทึกวันลาได้";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusUpdate = async (leaveId: string, status: LeaveRecord["status"]) => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/leaves/${leaveId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถอัปเดตสถานะวันลาได้");
      }
      setSuccessMessage("อัปเดตสถานะวันลาเรียบร้อย");
      await refreshLeaves();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ไม่สามารถอัปเดตสถานะวันลาได้";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (leaveId: string) => {
    if (!window.confirm("ต้องการลบรายการวันลานี้หรือไม่?")) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/leaves/${leaveId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถลบวันลาได้");
      }
      setSuccessMessage("ลบรายการวันลาเรียบร้อย");
      await refreshLeaves();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ไม่สามารถลบวันลาได้";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredLeaves = useMemo(() => {
    if (filterEmployeeId === "all") return leaves;
    return leaves.filter((leave) => leave.employeeId === filterEmployeeId);
  }, [filterEmployeeId, leaves]);

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return value;
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900">จัดการวันลา</h1>
        <p className="text-sm text-slate-500">
          กำหนดวันลาเพิ่มเติมนอกเหนือจากวันหยุดประจำของพนักงาน พร้อมติดตามสถานะการอนุมัติ
        </p>
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

      <section className="rounded-3xl border border-blue-100 bg-white/85 p-5 shadow-inner shadow-blue-100/50">
        <h2 className="text-sm font-semibold text-slate-800">
          บันทึกวันลาใหม่
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
              ประเภทการลา
            </label>
            <select
              value={formState.type}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  type: event.target.value,
                }))
              }
              className="mt-1 form-input"
            >
              {LEAVE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">
              วันเริ่มลา *
            </label>
            <input
              type="date"
              value={formState.startDate}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  startDate: event.target.value,
                }))
              }
              className="mt-1 form-input"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600">
              วันสิ้นสุด *
            </label>
            <input
              type="date"
              value={formState.endDate}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  endDate: event.target.value,
                }))
              }
              className="mt-1 form-input"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600">
              เหตุผล / รายละเอียด
            </label>
            <textarea
              value={formState.reason}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  reason: event.target.value,
                }))
              }
              className="mt-1 form-input min-h-[80px]"
              placeholder="รายละเอียดเพิ่มเติม เช่น ภารกิจ, สถานที่, เบอร์ติดต่อ"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600">
              บันทึกภายใน (ไม่บังคับ)
            </label>
            <textarea
              value={formState.note}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  note: event.target.value,
                }))
              }
              className="mt-1 form-input min-h-[60px]"
              placeholder="โน้ตสำหรับผู้ดูแล (จะไม่แสดงให้พนักงานเห็น)"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleCreate}
            disabled={isSaving || employees.length === 0}
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 via-sky-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_20px_60px_-45px_rgba(37,99,235,1)] transition hover:shadow-[0_24px_70px_-50px_rgba(37,99,235,1)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            บันทึกวันลา
          </button>
          <button
            type="button"
            onClick={() => setFormState((prev) => ({ ...EMPTY_LEAVE_FORM, employeeId: prev.employeeId || employees[0]?.id || "" }))}
            className="text-xs font-semibold text-slate-500 underline-offset-4 hover:underline"
          >
            ล้างฟอร์ม
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_24px_90px_-60px_rgba(37,99,235,0.35)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-sm font-semibold text-slate-800">รายการวันลา</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">กรองตามพนักงาน:</span>
            <select
              value={filterEmployeeId}
              onChange={(event) => setFilterEmployeeId(event.target.value)}
              className="form-input"
            >
              <option value="all">ทั้งหมด</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-blue-200 px-4 py-6 text-center text-sm text-blue-500">
            กำลังโหลดข้อมูล...
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-blue-200 px-4 py-6 text-center text-sm text-blue-500">
            ยังไม่มีข้อมูลวันลาในช่วงที่เลือก
          </div>
        ) : (
          <ul className="space-y-2 text-sm text-slate-600">
            {filteredLeaves.map((leave) => (
              <li
                key={leave.id}
                className="rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-[0_12px_40px_-30px_rgba(37,99,235,0.45)]"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {leave.employeeName} • {leave.type}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                    </p>
                    {(leave.reason || leave.note) && (
                      <div className="mt-2 space-y-1 text-xs text-slate-500">
                        {leave.reason && (
                          <p>
                            <span className="font-semibold text-slate-600">เหตุผล:</span>{" "}
                            {leave.reason}
                          </p>
                        )}
                        {leave.note && (
                          <p>
                            <span className="font-semibold text-slate-600">บันทึก:</span>{" "}
                            {leave.note}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <select
                      value={leave.status}
                      onChange={(event) =>
                        handleStatusUpdate(leave.id, event.target.value as LeaveRecord["status"])
                      }
                      disabled={isSaving}
                      className="form-input text-xs"
                    >
                      {LEAVE_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleDelete(leave.id)}
                      className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
