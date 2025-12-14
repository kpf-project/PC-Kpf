"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Download, RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";

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

type RestoreState =
  | { status: "idle" }
  | { status: "loading"; backupName: string }
  | { status: "success"; backupName: string }
  | { status: "error"; backupName: string; message: string };

export default function BackupsSection() {
  const [backupState, setBackupState] = useState<BackupState>({ status: "idle" });
  const [restoreState, setRestoreState] = useState<RestoreState>({ status: "idle" });

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

  const handleRestore = async (backupName: string) => {
    if (
      !confirm(
        `⚠️ คุณแน่ใจหรือไม่ที่จะกู้คืนข้อมูลจาก:\n\n${backupName}\n\nข้อมูลปัจจุบันจะถูกสำรองก่อนกู้คืน`
      )
    ) {
      return;
    }

    setRestoreState({ status: "loading", backupName });
    try {
      const response = await fetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupName }),
      });

      const result = (await response.json()) as { ok: boolean; message?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "ไม่สามารถกู้คืนข้อมูลได้");
      }

      setRestoreState({ status: "success", backupName });

      // Reload after 1.5 seconds
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถกู้คืนข้อมูลได้";
      setRestoreState({ status: "error", backupName, message });
    }
  };

  const backupList = backupState.status === "success" ? backupState.data : [];
  const isLoading = backupState.status === "loading";
  const hasError = backupState.status === "error";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30">
              <Database className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">สำรองข้อมูลอัตโนมัติ</h2>
              <p className="text-sm text-slate-500">จัดการและกู้คืนข้อมูลที่สำรองไว้</p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" strokeWidth={2} />
              <div className="text-sm text-amber-800">
                <p className="font-semibold">ระบบสำรองข้อมูลอัตโนมัติ</p>
                <p className="mt-1 text-amber-700">
                  ทุกครั้งที่มีการเพิ่ม/แก้ไข/ลบ ข้อมูลพนักงาน ร้านค้า หรือสินค้า ระบบจะสร้างไฟล์สำรองอัตโนมัติ
                  (เก็บ 10 ไฟล์ล่าสุด)
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={fetchBackups}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} strokeWidth={2} />
          รีเฟรช
        </button>
      </div>

      {/* Success Message */}
      {restoreState.status === "success" && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" strokeWidth={2} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-900">กู้คืนข้อมูลสำเร็จ!</p>
              <p className="mt-1 text-sm text-green-700">
                กำลังโหลดหน้าเว็บใหม่เพื่อแสดงข้อมูลที่กู้คืนแล้ว...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {hasError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" strokeWidth={2} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">เกิดข้อผิดพลาด</p>
              <p className="mt-1 text-sm text-red-700">{backupState.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Backup List */}
      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white/60 p-12 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-slate-400" strokeWidth={2} />
          <p className="mt-4 text-sm text-slate-500">กำลังโหลดรายการสำรองข้อมูล...</p>
        </div>
      ) : backupList.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white/60 p-12 text-center">
          <Database className="mx-auto h-12 w-12 text-slate-300" strokeWidth={1.5} />
          <p className="mt-4 text-base font-medium text-slate-600">ยังไม่มีไฟล์สำรองข้อมูล</p>
          <p className="mt-2 text-sm text-slate-500">
            ไฟล์สำรองจะถูกสร้างอัตโนมัติเมื่อมีการแก้ไขข้อมูล
          </p>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {backupList.map((backup, index) => {
              const isRestoring = restoreState.status === "loading" && restoreState.backupName === backup.name;
              const hasRestoreError =
                restoreState.status === "error" && restoreState.backupName === backup.name;

              return (
                <div
                  key={backup.name}
                  className="flex items-center gap-4 px-6 py-4 transition hover:bg-slate-50"
                >
                  {/* Index Badge */}
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-bold text-slate-700">
                    {index + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" strokeWidth={2} />
                      <p className="text-sm font-semibold text-slate-900">{backup.timestampFormatted}</p>
                      {index === 0 && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          ล่าสุด
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{backup.name}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestore(backup.name)}
                      disabled={isRestoring || restoreState.status === "success"}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-green-500/30 transition hover:shadow-xl hover:shadow-green-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRestoring ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={2} />
                          กำลังกู้คืน...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" strokeWidth={2} />
                          กู้คืนข้อมูล
                        </>
                      )}
                    </button>
                  </div>

                  {/* Error Message */}
                  {hasRestoreError && (
                    <div className="w-full rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="text-xs text-red-700">{restoreState.message}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Note */}
      {backupList.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <Database className="h-5 w-5 flex-shrink-0 text-slate-400" strokeWidth={2} />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-700">ข้อมูลสำคัญ:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-slate-600">
                <li>ระบบเก็บไฟล์สำรอง 10 ไฟล์ล่าสุดเท่านั้น</li>
                <li>ก่อนกู้คืน ระบบจะสำรองข้อมูลปัจจุบันอัตโนมัติ</li>
                <li>หลังกู้คืนสำเร็จ หน้าเว็บจะรีเฟรชอัตโนมัติ</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
