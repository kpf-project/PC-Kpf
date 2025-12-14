"use client";

import { useState, useEffect } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";

export default function GPSSection() {
  const queryClient = useQueryClient();
  const [isEnabled, setIsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch current GPS setting
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json() as Promise<{ gps_required?: boolean }>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update local state when data loads
  useEffect(() => {
    if (settings && settings.gps_required !== undefined) {
      setIsEnabled(settings.gps_required);
    }
  }, [settings]);

  // Auto-dismiss success message
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Mutation to save GPS setting
  const saveMutation = useMutation({
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
      setSuccessMessage("บันทึกการตั้งค่า GPS เรียบร้อย");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  const handleToggle = () => {
    const newValue = !isEnabled;
    setIsEnabled(newValue);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await saveMutation.mutateAsync(isEnabled);
    } catch {
      // Error handled by mutation
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-b-transparent" />
        <span className="ml-3 text-sm text-slate-500">กำลังโหลดการตั้งค่า...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-800">การใช้งาน GPS</h3>
        <p className="mt-1 text-sm text-slate-500">
          กำหนดว่าจะบังคับให้ใช้พิกัด GPS ในการลงเวลาและบันทึกยอดขายหรือไม่
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-600">
          {successMessage}
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-blue-100 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label htmlFor="gps-toggle" className="block text-sm font-semibold text-slate-700">
              บังคับใช้ GPS
            </label>
            <p className="mt-1 text-xs text-slate-500">
              {isEnabled
                ? "พนักงานต้องเปิด GPS และอยู่ในพื้นที่กำหนดเพื่อลงเวลา"
                : "พนักงานสามารถเลือกร้านค้าด้วยตนเองโดยไม่ต้องใช้ GPS"}
            </p>
          </div>
          <button
            type="button"
            id="gps-toggle"
            onClick={handleToggle}
            className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isEnabled ? "bg-blue-600" : "bg-slate-300"
            }`}
            role="switch"
            aria-checked={isEnabled}
          >
            <span
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isEnabled ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            📋 รายละเอียด
          </h4>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            <li className="flex gap-2">
              <span className="text-blue-500">•</span>
              <span>
                <strong>เปิด GPS:</strong> พนักงานต้องอยู่ในรัศมีที่กำหนดของร้านค้า
                ระบบจะตรวจสอบตำแหน่งอัตโนมัติ
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-500">•</span>
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
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_20px_60px_-45px_rgba(37,99,235,1)] transition hover:shadow-[0_24px_70px_-50px_rgba(37,99,235,1)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
          </button>
        </div>
      </div>
    </div>
  );
}

