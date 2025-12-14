"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEventHandler } from "react";
import type { BrandingSettings } from "@/lib/supabaseBranding";
import { getBrandingLogoSrc } from "@/lib/branding";

type Props = {
  initialBranding: BrandingSettings;
};

type StatusState = {
  type: "idle" | "success" | "error";
  message: string | null;
};

const MAX_PREVIEW_SIZE_MB = 2;

export default function BrandingSettingsPanel({ initialBranding }: Props) {
  const [persistedBranding, setPersistedBranding] = useState<BrandingSettings>(initialBranding);
  const [displayUrl, setDisplayUrl] = useState<string | null>(
    getBrandingLogoSrc(initialBranding.logoPath, initialBranding.updatedAt, null),
  );
  const [objectPreviewUrl, setObjectPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState>({
    type: "idle",
    message: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (objectPreviewUrl) {
        URL.revokeObjectURL(objectPreviewUrl);
      }
    };
  }, [objectPreviewUrl]);

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (file.size > MAX_PREVIEW_SIZE_MB * 1024 * 1024) {
      setStatus({
        type: "error",
        message: `ไฟล์ใหญ่เกินกำหนด (สูงสุด ${MAX_PREVIEW_SIZE_MB}MB)`,
      });
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    if (objectPreviewUrl) {
      URL.revokeObjectURL(objectPreviewUrl);
    }
    setObjectPreviewUrl(objectUrl);
    setDisplayUrl(objectUrl);
    void uploadLogo(file, objectUrl);
  };

  const uploadLogo = async (file: File, previewUrl: string) => {
    setIsSubmitting(true);
    setStatus({ type: "idle", message: null });
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const response = await fetch("/api/admin/branding", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        logoPath?: string | null;
        updatedAt?: string | null;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "ไม่สามารถอัปโหลดโลโก้ได้");
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setObjectPreviewUrl(null);
      const nextBranding: BrandingSettings = {
        logoPath: payload.logoPath ?? null,
        updatedAt: payload.updatedAt ?? new Date().toISOString(),
      };
      setPersistedBranding(nextBranding);
      const nextUrl = getBrandingLogoSrc(nextBranding.logoPath, nextBranding.updatedAt, null);
      setDisplayUrl(nextUrl);
      if (typeof window !== "undefined") {
        if (nextUrl) {
          window.sessionStorage.setItem("branding:logo-src", nextUrl);
        } else {
          window.sessionStorage.removeItem("branding:logo-src");
        }
        document.body.dataset.brandingLogo = nextUrl ?? "";
        document.body.dataset.brandingUpdatedAt = nextBranding.updatedAt;
        window.dispatchEvent(
          new CustomEvent("branding:logo-updated", {
            detail: { logo: nextUrl ?? "", updatedAt: nextBranding.updatedAt },
          }),
        );
      }
      setStatus({ type: "success", message: "อัปเดตโลโก้เรียบร้อยแล้ว" });
    } catch (error) {
      console.error("[BrandingSettingsPanel] upload failed", error);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setObjectPreviewUrl(null);
      setDisplayUrl(
        getBrandingLogoSrc(persistedBranding.logoPath, persistedBranding.updatedAt, null),
      );
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "ไม่สามารถอัปโหลดโลโก้ได้ กรุณาลองใหม่",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatus({ type: "idle", message: null });
    if (objectPreviewUrl) {
      URL.revokeObjectURL(objectPreviewUrl);
      setObjectPreviewUrl(null);
    }
    try {
      const response = await fetch("/api/admin/branding", { method: "DELETE" });
      const payload = (await response.json()) as {
        error?: string;
        logoPath?: string | null;
        updatedAt?: string | null;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "ไม่สามารถรีเซ็ตโลโก้ได้");
      }
      const nextBranding: BrandingSettings = {
        logoPath: payload.logoPath ?? null,
        updatedAt: payload.updatedAt ?? new Date().toISOString(),
      };
      setPersistedBranding(nextBranding);
      const nextUrl = getBrandingLogoSrc(nextBranding.logoPath, nextBranding.updatedAt, null);
      setDisplayUrl(nextUrl);
      if (typeof window !== "undefined") {
        if (nextUrl) {
          window.sessionStorage.setItem("branding:logo-src", nextUrl);
        } else {
          window.sessionStorage.removeItem("branding:logo-src");
        }
        document.body.dataset.brandingLogo = nextUrl ?? "";
        document.body.dataset.brandingUpdatedAt = nextBranding.updatedAt;
        window.dispatchEvent(
          new CustomEvent("branding:logo-updated", {
            detail: { logo: nextUrl ?? "", updatedAt: nextBranding.updatedAt },
          }),
        );
      }
      setStatus({ type: "success", message: "รีเซ็ตโลโก้เรียบร้อยแล้ว" });
    } catch (error) {
      console.error("[BrandingSettingsPanel] reset failed", error);
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "ไม่สามารถรีเซ็ตโลโก้ได้ กรุณาลองอีกครั้ง",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewIsObjectUrl =
    typeof displayUrl === "string" &&
    (displayUrl.startsWith("blob:") || displayUrl.startsWith("data:"));

  return (
    <section className="rounded-3xl border border-white/70 bg-white/92 p-6 shadow-[0_40px_140px_-120px_rgba(37,99,235,0.7)] lg:backdrop-blur-sm sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-6 text-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
            {displayUrl ? (
              <Image
                src={displayUrl}
                alt="ตัวอย่างโลโก้"
                width={96}
                height={96}
                className="h-full w-full rounded-2xl object-cover"
                unoptimized={previewIsObjectUrl}
              />
            ) : (
              <span className="text-lg font-semibold text-blue-500">KF</span>
            )}
          </div>
          <div className="space-y-1 text-xs text-slate-500">
            <p>รองรับไฟล์ PNG, JPG, WEBP, GIF, SVG</p>
            <p>ขนาดสูงสุด {MAX_PREVIEW_SIZE_MB}MB</p>
          </div>
        </div>
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            อัปโหลดโลโก้ใหม่เพื่อใช้แทนไอคอนเริ่มต้นบนเมนูหลัก ผู้ใช้จะเห็นโลโก้ทันทีหลังจาก
            รีเฟรชหน้าเว็บ
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePickFile}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_20px_60px_-45px_rgba(37,99,235,1)] transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "กำลังอัปโหลด..." : "เลือกโลโก้ใหม่"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting || (!persistedBranding.logoPath && !objectPreviewUrl)}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              รีเซ็ตกลับเป็นค่าเริ่มต้น
            </button>
          </div>
          <p className="text-xs text-slate-400">
            เคล็ดลับ: ใช้โลโก้พื้นหลังโปร่งใส (PNG หรือ WEBP) เพื่อให้เข้ากับดีไซน์ได้ดีที่สุด
          </p>
          {status.message && (
            <div
              className={`rounded-2xl border px-4 py-3 text-xs font-medium ${
                status.type === "error"
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-emerald-200 bg-emerald-50 text-emerald-600"
              }`}
            >
              {status.message}
            </div>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </section>
  );
}
