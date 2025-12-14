"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { PhotoRecord } from "@/lib/supabasePhotos";

interface PhotoDetailModalProps {
  photo: PhotoRecord;
  isOpen: boolean;
  onClose: () => void;
}

export default function PhotoDetailModal({
  photo,
  isOpen,
  onClose,
}: PhotoDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const hasPhoto = !!photo.photoPublicUrl;
  const hasLocation = photo.latitude !== null && photo.longitude !== null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative max-w-5xl w-full max-h-[90vh] bg-white border border-slate-400 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-300 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">รายละเอียดภาพถ่าย</h2>
            <p className="text-xs text-slate-600 mt-1 uppercase tracking-wider">
              {photo.status === "check-in" ? "เข้างาน" : "ออกงาน"} • {photo.recordedTime}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-colors"
            aria-label="ปิด"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Photo Display */}
            <div className="space-y-4">
              <div className="aspect-[3/4] relative bg-slate-100 border border-slate-300 overflow-hidden">
                {hasPhoto && photo.photoPublicUrl ? (
                  <Image
                    src={photo.photoPublicUrl}
                    alt={`${photo.employeeName} - ${photo.status}`}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm font-semibold uppercase tracking-wide">ไม่มีภาพถ่าย</p>
                  </div>
                )}
              </div>

              {hasPhoto && photo.photoPublicUrl && (
                <a
                  href={photo.photoPublicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-slate-900 hover:text-slate-900 hover:bg-slate-100 border border-slate-400 transition-colors uppercase tracking-wider"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  เปิดภาพขนาดเต็ม
                </a>
              )}
            </div>

            {/* Details */}
            <div className="space-y-4">
              {/* Attendance Info */}
              <div className="bg-slate-50 border border-slate-300 p-4">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-slate-900"></div>
                  ข้อมูลการลงเวลา
                </h3>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-2 text-slate-600 font-medium w-28">พนักงาน</td>
                      <td className="py-2 text-slate-900 font-semibold">{photo.employeeName}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 font-medium">ร้าน</td>
                      <td className="py-2 text-slate-900">
                        {photo.storeName || <span className="text-slate-400 italic">ไม่ระบุ</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 font-medium">วันที่</td>
                      <td className="py-2 text-slate-900">
                        {new Date(photo.recordedDate + "T00:00:00").toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 font-medium">เวลา</td>
                      <td className="py-2 text-slate-900 font-mono">{photo.recordedTime}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 font-medium">สถานะ</td>
                      <td className="py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            photo.status === "check-in"
                              ? "bg-emerald-50 text-emerald-900 border border-emerald-400"
                              : "bg-sky-50 text-sky-900 border border-sky-400"
                          }`}
                        >
                          {photo.status === "check-in" ? "เข้างาน" : "ออกงาน"}
                        </span>
                      </td>
                    </tr>
                    {photo.note && (
                      <tr>
                        <td className="py-2 text-slate-600 font-medium align-top">หมายเหตุ</td>
                        <td className="py-2 text-slate-700 leading-relaxed">{photo.note}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Location Info */}
              {hasLocation && (
                <div className="bg-sky-50 border border-sky-400 p-4">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-sky-600"></div>
                    ข้อมูลตำแหน่ง
                  </h3>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-sky-200">
                      <tr>
                        <td className="py-2 text-slate-600 font-medium w-28">GPS</td>
                        <td className="py-2 font-mono text-[10px] text-slate-900">
                          {photo.latitude?.toFixed(6)}°N, {photo.longitude?.toFixed(6)}°E
                        </td>
                      </tr>
                      {photo.accuracy !== null && (
                        <tr>
                          <td className="py-2 text-slate-600 font-medium">ความแม่นยำ</td>
                          <td className="py-2 text-slate-900">
                            ±{photo.accuracy.toFixed(0)} เมตร
                            {photo.accuracy <= 20 && (
                              <span className="ml-2 text-emerald-600 font-bold">แม่นยำ</span>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <div className="pt-3 mt-3 border-t border-sky-200">
                    <a
                      href={`https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-sky-900 hover:text-sky-900 hover:bg-sky-100 border border-sky-400 transition-colors uppercase tracking-wider"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      ดูบน Google Maps
                    </a>
                  </div>
                </div>
              )}

              {/* Technical Info */}
              <div className="bg-slate-50 border border-slate-300 p-4">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-slate-900"></div>
                  ข้อมูลเทคนิค
                </h3>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-2 text-slate-600 font-medium w-28">Record ID</td>
                      <td className="py-2 font-mono text-[10px] text-slate-600 break-all">{photo.id}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 font-medium">Created</td>
                      <td className="py-2 text-[10px] text-slate-600">
                        {new Date(photo.createdAt).toLocaleString("th-TH")}
                      </td>
                    </tr>
                    {photo.storagePath && (
                      <tr>
                        <td className="py-2 text-slate-600 font-medium">Storage</td>
                        <td className="py-2 font-mono text-[10px] text-slate-600 break-all">
                          {photo.storagePath}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-300 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-900 hover:text-slate-900 hover:bg-slate-200 border border-slate-400 transition-colors uppercase tracking-wider"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
