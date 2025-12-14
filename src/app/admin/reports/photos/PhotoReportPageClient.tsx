"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PhotoTimelineItem, PhotoStatistics } from "@/lib/supabasePhotos";
import PhotoFilters, { type PhotoFiltersState } from "./components/PhotoFilters";
import PhotoTimeline from "./components/PhotoTimeline";
import PhotoComparison from "./components/PhotoComparison";
import PhotoGalleryVirtualized from "./components/PhotoGalleryVirtualized";

type ViewMode = "timeline" | "comparison" | "gallery";

interface Employee {
  id: string;
  name: string;
  employeeCode: string | null;
}

interface Store {
  id: string;
  name: string;
}

interface PhotoReportData {
  timeline: PhotoTimelineItem[];
  statistics: PhotoStatistics;
  employee: Employee;
  store: Store | null;
  filters: {
    startDate: string;
    endDate: string;
    storeId: string | null;
  };
}

interface PhotoReportPageClientProps {
  initialEmployees: Array<{ id: string; name: string }>;
  initialStores: Array<{ id: string; name: string }>;
}

export default function PhotoReportPageClient({
  initialEmployees,
}: PhotoReportPageClientProps) {
  const getCurrentMonthRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  };

  const defaultRange = getCurrentMonthRange();
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [filters, setFilters] = useState<PhotoFiltersState>({
    employeeId: initialEmployees[0]?.id || "",
    startDate: defaultRange.start,
    endDate: defaultRange.end,
  });

  const { data: reportData, isLoading, error, refetch } = useQuery<PhotoReportData>({
    queryKey: ["photoReport", filters],
    queryFn: async () => {
      if (!filters.employeeId) {
        throw new Error("กรุณาเลือกพนักงาน");
      }

      const params = new URLSearchParams({
        employeeId: filters.employeeId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      const response = await fetch(`/api/admin/reports/photos?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch photo report");
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Invalid response format");
      }

      return result.data;
    },
    enabled: !!filters.employeeId,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  });

  const handleFilterChange = (newFilters: PhotoFiltersState) => {
    setFilters(newFilters);
  };

  const handlePrint = () => {
    if (!reportData || !reportData.timeline) return;

    // Filter only days with photos
    const daysWithPhotos = reportData.timeline.filter(
      (item) =>
        (item.checkInPhoto && item.checkInPhoto.photoPublicUrl) ||
        (item.checkOutPhoto && item.checkOutPhoto.photoPublicUrl)
    );

    if (daysWithPhotos.length === 0) {
      alert("ไม่มีภาพถ่ายสำหรับพิมพ์");
      return;
    }

    const printTimestamp = new Intl.DateTimeFormat("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());

    // Build photo grid HTML
    const photosHtml = daysWithPhotos
      .flatMap((item) => {
        const photos: Array<{ url: string; type: string; date: string; time: string; store: string }> = [];

        if (item.checkInPhoto && item.checkInPhoto.photoPublicUrl) {
          photos.push({
            url: item.checkInPhoto.photoPublicUrl,
            type: "เข้างาน",
            date: item.dayLabel,
            time: item.checkInPhoto.recordedTime,
            store: item.checkInPhoto.storeName || "-",
          });
        }

        if (item.checkOutPhoto && item.checkOutPhoto.photoPublicUrl) {
          photos.push({
            url: item.checkOutPhoto.photoPublicUrl,
            type: "ออกงาน",
            date: item.dayLabel,
            time: item.checkOutPhoto.recordedTime,
            store: item.checkOutPhoto.storeName || "-",
          });
        }

        return photos;
      })
      .map(
        (photo) => `
        <div class="photo-item">
          <img src="${photo.url}" alt="${photo.type}" />
          <div class="photo-info">
            <div class="photo-type">${photo.type}</div>
            <div class="photo-date">${photo.date}</div>
            <div class="photo-time">${photo.time}</div>
            <div class="photo-store">${photo.store}</div>
          </div>
        </div>
      `
      )
      .join("");

    const printHtml = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>รายงานภาพถ่ายการลงเวลา</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Sarabun', 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 12pt;
            line-height: 1.4;
            color: #1e293b;
            background: white;
          }

          .header {
            border-bottom: 2px solid #2563eb;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }

          .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
          }

          .header-title {
            font-size: 18pt;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 6px;
          }

          .header-info {
            font-size: 10pt;
            color: #475569;
            line-height: 1.5;
          }

          .header-timestamp {
            font-size: 9pt;
            color: #64748b;
            text-align: right;
            font-family: monospace;
          }

          .stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }

          .stat-box {
            border: 1px solid #cbd5e1;
            border-left: 4px solid #3b82f6;
            padding: 10px;
            background: #f8fafc;
          }

          .stat-label {
            font-size: 9pt;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }

          .stat-value {
            font-size: 20pt;
            font-weight: bold;
            color: #1e40af;
          }

          .stat-unit {
            font-size: 10pt;
            color: #64748b;
            margin-left: 4px;
          }

          .photo-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-top: 20px;
          }

          .photo-item {
            border: 2px solid #e0e7ff;
            border-radius: 8px;
            overflow: hidden;
            page-break-inside: avoid;
            background: white;
          }

          .photo-item img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            display: block;
            border-bottom: 2px solid #e0e7ff;
          }

          .photo-info {
            padding: 8px;
            background: #f1f5f9;
          }

          .photo-type {
            font-weight: bold;
            color: #1e40af;
            font-size: 11pt;
            margin-bottom: 4px;
          }

          .photo-date {
            font-size: 10pt;
            color: #334155;
            margin-bottom: 2px;
          }

          .photo-time {
            font-size: 9pt;
            color: #64748b;
            font-family: monospace;
            margin-bottom: 2px;
          }

          .photo-store {
            font-size: 9pt;
            color: #64748b;
          }

          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #cbd5e1;
            text-align: center;
            font-size: 9pt;
            color: #94a3b8;
          }

          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }

            .photo-grid {
              page-break-before: auto;
            }

            .photo-item {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-top">
            <div>
              <div class="header-title">รายงานภาพถ่ายการลงเวลา</div>
              <div class="header-info">
                <div>พนักงาน: ${reportData.employee.name}</div>
                ${reportData.store ? `<div>ร้าน: ${reportData.store.name}</div>` : ""}
                <div>ช่วงเวลา: ${reportData.filters.startDate} ถึง ${reportData.filters.endDate}</div>
              </div>
            </div>
            <div class="header-timestamp">
              <div>พิมพ์เมื่อ</div>
              <div>${printTimestamp}</div>
            </div>
          </div>
        </div>

        <div class="stats">
          <div class="stat-box">
            <div class="stat-label">ทั้งหมด</div>
            <div class="stat-value">${reportData.statistics.totalRecords}<span class="stat-unit">ครั้ง</span></div>
          </div>
          <div class="stat-box">
            <div class="stat-label">มีภาพครบ</div>
            <div class="stat-value">${reportData.statistics.recordsWithPhoto}<span class="stat-unit">ครั้ง</span></div>
          </div>
          <div class="stat-box">
            <div class="stat-label">ไม่มีภาพ</div>
            <div class="stat-value">${reportData.statistics.recordsWithoutPhoto}<span class="stat-unit">ครั้ง</span></div>
          </div>
          <div class="stat-box">
            <div class="stat-label">ความสำเร็จ</div>
            <div class="stat-value">${reportData.statistics.photoCompletionRate}<span class="stat-unit">%</span></div>
          </div>
        </div>

        <div class="photo-grid">
          ${photosHtml}
        </div>

        <div class="footer">
          สร้างโดยระบบอัตโนมัติ - ${reportData.employee.name}
        </div>
      </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("กรุณาอนุญาตให้เปิดหน้าต่างใหม่");
      return;
    }

    printWindow.document.write(printHtml);
    printWindow.document.close();

    // Wait for images to load before printing
    printWindow.onload = () => {
      const images = printWindow.document.getElementsByTagName("img");
      let loadedCount = 0;
      const totalImages = images.length;

      if (totalImages === 0) {
        printWindow.print();
        return;
      }

      Array.from(images).forEach((img) => {
        if (img.complete) {
          loadedCount++;
        } else {
          img.onload = () => {
            loadedCount++;
            if (loadedCount === totalImages) {
              setTimeout(() => printWindow.print(), 500);
            }
          };
          img.onerror = () => {
            loadedCount++;
            if (loadedCount === totalImages) {
              setTimeout(() => printWindow.print(), 500);
            }
          };
        }
      });

      if (loadedCount === totalImages) {
        setTimeout(() => printWindow.print(), 500);
      }
    };
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 print:bg-white">
        {/* Print Header */}
        <div className="hidden print:block mb-6 pb-4 border-b-2 border-blue-600">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-blue-900 mb-1">รายงานภาพถ่ายการลงเวลา</h1>
              {reportData && (
                <div className="text-xs text-blue-700 space-y-0.5 font-mono">
                  <div>พนักงาน: {reportData.employee.name}</div>
                  <div>
                    ช่วงเวลา: {reportData.filters.startDate} ถึง {reportData.filters.endDate}
                  </div>
                </div>
              )}
            </div>
            <div className="text-right text-[10px] text-blue-600 font-mono">
              <div>{new Date().toLocaleDateString("th-TH")}</div>
              <div>{new Date().toLocaleTimeString("th-TH")}</div>
            </div>
          </div>
        </div>

        {/* Main Container */}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Filters */}
          <PhotoFilters
            employees={initialEmployees}
            initialFilters={filters}
            onFilterChange={handleFilterChange}
            isLoading={isLoading}
          />

          {/* Statistics Panel */}
          {reportData && !isLoading && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="ทั้งหมด"
                  value={reportData.statistics.totalRecords.toString()}
                  unit="ครั้ง"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  }
                  gradient="from-blue-500 to-cyan-500"
                />
                <StatCard
                  label="มีภาพครบ"
                  value={reportData.statistics.recordsWithPhoto.toString()}
                  unit="ครั้ง"
                  subtitle={`${reportData.statistics.photoCompletionRate}%`}
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  gradient="from-emerald-500 to-teal-500"
                />
                <StatCard
                  label="ไม่มีภาพ"
                  value={reportData.statistics.recordsWithoutPhoto.toString()}
                  unit="ครั้ง"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  }
                  gradient="from-rose-500 to-pink-500"
                />
                <StatCard
                  label="ความสำเร็จ"
                  value={reportData.statistics.photoCompletionRate.toString()}
                  unit="%"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  }
                  gradient="from-amber-500 to-orange-500"
                />
              </div>

              {/* Report Info Card */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-blue-200/50 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-3">
                  <h3 className="text-white font-bold text-sm">ข้อมูลรายงาน</h3>
                </div>
                <div className="px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs text-blue-600 font-medium">พนักงาน</div>
                      <div className="text-sm font-bold text-blue-900">{reportData.employee.name}</div>
                    </div>
                  </div>
                  {reportData.store && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-xs text-blue-600 font-medium">ร้าน</div>
                        <div className="text-sm font-bold text-blue-900">{reportData.store.name}</div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs text-blue-600 font-medium">ช่วงเวลา</div>
                      <div className="text-sm font-bold text-blue-900 font-mono">
                        {reportData.filters.startDate} — {reportData.filters.endDate}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* View Controls */}
          {reportData && !isLoading && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 print:hidden">
              {/* View Tabs */}
              <div className="inline-flex bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-blue-200/50 p-1 overflow-hidden">
                <ViewButton
                  active={viewMode === "timeline"}
                  onClick={() => setViewMode("timeline")}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  label="รายการตามวัน"
                />
                <ViewButton
                  active={viewMode === "comparison"}
                  onClick={() => setViewMode("comparison")}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  }
                  label="เปรียบเทียบ"
                />
                <ViewButton
                  active={viewMode === "gallery"}
                  onClick={() => setViewMode("gallery")}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                  label="แกลเลอรี"
                />
              </div>

              {/* Print Button */}
              <button
                onClick={handlePrint}
                className="group px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 font-bold text-sm flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                พิมพ์รายงาน
              </button>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-blue-200/50 p-20 text-center">
              <div className="inline-block w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="text-base text-blue-700 font-semibold">กำลังโหลดข้อมูล...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border-2 border-rose-400 p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-rose-500 to-pink-500 rounded-3xl mx-auto mb-6 flex items-center justify-center transform rotate-12">
                <svg className="w-10 h-10 text-white -rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-rose-900 mb-3">เกิดข้อผิดพลาด</h3>
              <p className="text-sm text-rose-700 mb-6">{error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลได้"}</p>
              <button
                onClick={() => refetch()}
                className="px-8 py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all font-bold"
              >
                ลองอีกครั้ง
              </button>
            </div>
          )}

          {/* Content Views */}
          {reportData && !isLoading && !error && (
            <>
              {viewMode === "timeline" && <PhotoTimeline timeline={reportData.timeline} employeeName={reportData.employee.name} />}
              {viewMode === "comparison" && <PhotoComparison timeline={reportData.timeline} employeeName={reportData.employee.name} />}
              {viewMode === "gallery" && <PhotoGalleryVirtualized timeline={reportData.timeline} employeeName={reportData.employee.name} />}
            </>
          )}

          {/* Empty State */}
          {!isLoading && !error && !filters.employeeId && (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-blue-200/50 p-20 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl mx-auto mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-blue-900 mb-2">เลือกพนักงาน</h3>
              <p className="text-sm text-blue-600">กรุณาเลือกพนักงานเพื่อดูรายงาน</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  unit: string;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
}

function StatCard({ label, value, unit, subtitle, icon, gradient }: StatCardProps) {
  return (
    <div className="group relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-blue-200/50">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg`}>
            {icon}
          </div>
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{label}</div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-4xl font-bold text-blue-900 leading-none">{value}</div>
          <div className="text-base font-semibold text-blue-600">{unit}</div>
        </div>
        {subtitle && <div className="text-sm font-bold text-blue-700 mt-2">({subtitle})</div>}
      </div>
    </div>
  );
}

interface ViewButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function ViewButton({ active, onClick, icon, label }: ViewButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
        active
          ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg scale-105"
          : "text-blue-700 hover:bg-blue-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
