"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Users, Store, Package, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import clsx from "clsx";

interface Employee {
  id: string;
  name: string;
  storeIds?: string[];
}

interface StoreOption {
  id: string;
  name: string;
}

interface CopyAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetEmployeeId: string;
  targetStoreName?: string;
  targetStoreId?: string;
  employees: Employee[];
  stores: StoreOption[];
  onSuccess: () => void;
}

export default function CopyAssignmentModal({
  isOpen,
  onClose,
  targetEmployeeId,
  targetStoreName,
  targetStoreId,
  employees,
  stores,
  onSuccess,
}: CopyAssignmentModalProps) {
  const [sourceEmployeeId, setSourceEmployeeId] = useState("");
  const [sourceStoreId, setSourceStoreId] = useState<string>("");
  const [assignmentCount, setAssignmentCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted (for portal)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '0px';
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isOpen]);

  // Filter employees (exclude target employee)
  const availableEmployees = employees.filter((emp) => emp.id !== targetEmployeeId);

  // Get stores for selected source employee
  const sourceEmployee = employees.find((emp) => emp.id === sourceEmployeeId);
  const availableStores = sourceEmployee?.storeIds
    ? stores.filter((store) => sourceEmployee.storeIds!.includes(store.id))
    : stores;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSourceEmployeeId("");
      setSourceStoreId("");
      setAssignmentCount(null);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  // Fetch assignment count when source employee/store changes
  useEffect(() => {
    if (!sourceEmployeeId) {
      setAssignmentCount(null);
      return;
    }

    async function fetchCount() {
      setIsLoadingCount(true);
      setError(null);
      try {
        const params = new URLSearchParams({ employeeId: sourceEmployeeId });
        if (sourceStoreId) {
          params.set("storeId", sourceStoreId);
        }

        const response = await fetch(`/api/admin/product-assignments/copy?${params.toString()}`);
        if (!response.ok) {
          throw new Error("ไม่สามารถดึงข้อมูลได้");
        }

        const data = (await response.json()) as { success: boolean; count: number };
        setAssignmentCount(data.count);
      } catch (err) {
        const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
        setError(message);
        setAssignmentCount(null);
      } finally {
        setIsLoadingCount(false);
      }
    }

    void fetchCount();
  }, [sourceEmployeeId, sourceStoreId]);

  async function handleCopy() {
    if (!sourceEmployeeId) {
      setError("กรุณาเลือกพนักงานต้นทาง");
      return;
    }

    if (assignmentCount === 0) {
      setError("ไม่มีการผูกสินค้าให้คัดลอก");
      return;
    }

    setIsCopying(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/product-assignments/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromEmployeeId: sourceEmployeeId,
          toEmployeeId: targetEmployeeId,
          fromStoreId: sourceStoreId || null,
          toStoreId: targetStoreId || null,
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        message: string;
        copied: number;
        skipped: number;
        errors?: string[];
      };

      if (!response.ok || !data.success) {
        throw new Error(data.message || "ไม่สามารถคัดลอกการผูกสินค้าได้");
      }

      setSuccess(data.message);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการคัดลอก";
      setError(message);
    } finally {
      setIsCopying(false);
    }
  }

  if (!isOpen || !mounted) return null;

  const targetEmployee = employees.find((emp) => emp.id === targetEmployeeId);
  const sourceEmployeeName = employees.find((emp) => emp.id === sourceEmployeeId)?.name;
  const sourceStoreName = sourceStoreId
    ? stores.find((store) => store.id === sourceStoreId)?.name
    : "ทุกพื้นที่";

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl mx-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 bg-gradient-to-r from-sky-50 to-blue-50">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-200">
                <Copy className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">คัดลอกการผูกสินค้า</h2>
                <p className="text-sm text-slate-600">คัดลอกรายการสินค้าและราคาจากพนักงานอื่น</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6">
            {/* Target Info */}
            <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-semibold text-blue-900">ปลายทาง (จะรับการคัดลอก)</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white border border-blue-100 px-4 py-3">
                  <p className="text-xs font-semibold text-blue-600 mb-1">พนักงาน</p>
                  <p className="text-sm font-bold text-slate-900">{targetEmployee?.name}</p>
                </div>
                <div className="rounded-xl bg-white border border-blue-100 px-4 py-3">
                  <p className="text-xs font-semibold text-blue-600 mb-1">พื้นที่</p>
                  <p className="text-sm font-bold text-slate-900">{targetStoreName || "ทุกพื้นที่"}</p>
                </div>
              </div>
            </div>

            {/* Source Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Copy className="h-5 w-5 text-slate-600" />
                <h3 className="text-sm font-semibold text-slate-900">เลือกต้นทาง (คัดลอกจาก)</h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Source Employee */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    พนักงานต้นทาง *
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={sourceEmployeeId}
                      onChange={(e) => {
                        setSourceEmployeeId(e.target.value);
                        setSourceStoreId("");
                      }}
                      disabled={isCopying}
                      className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">เลือกพนักงาน...</option>
                      {availableEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Source Store */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    พื้นที่ต้นทาง
                  </label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={sourceStoreId}
                      onChange={(e) => setSourceStoreId(e.target.value)}
                      disabled={!sourceEmployeeId || isCopying}
                      className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60"
                    >
                      <option value="">ทุกพื้นที่</option>
                      {availableStores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Assignment Count Preview */}
            {sourceEmployeeId && (
              <div
                className={clsx(
                  "rounded-2xl border-2 p-4 transition-all",
                  assignmentCount !== null && assignmentCount > 0
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-slate-200 bg-slate-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      "flex h-10 w-10 items-center justify-center rounded-xl",
                      assignmentCount !== null && assignmentCount > 0
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-slate-200 text-slate-500"
                    )}
                  >
                    {isLoadingCount ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Package className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    {isLoadingCount ? (
                      <p className="text-sm text-slate-600">กำลังตรวจสอบจำนวนสินค้า...</p>
                    ) : assignmentCount !== null ? (
                      <>
                        <p className="text-lg font-bold text-slate-900">
                          {assignmentCount} สินค้า
                        </p>
                        <p className="text-xs text-slate-600">
                          จาก {sourceEmployeeName} · {sourceStoreName}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-600">เลือกพนักงานเพื่อดูจำนวนสินค้า</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-700">{success}</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              disabled={isCopying}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!sourceEmployeeId || isCopying || assignmentCount === 0 || isLoadingCount}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-200 transition hover:from-sky-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {isCopying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังคัดลอก...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  คัดลอก {assignmentCount ? `${assignmentCount} สินค้า` : ""}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
