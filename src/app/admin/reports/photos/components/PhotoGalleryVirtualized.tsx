"use client";

import { useState, useMemo, useEffect } from "react";
import { FixedSizeGrid as Grid } from "react-window";
import Image from "next/image";
import type { PhotoTimelineItem, PhotoRecord } from "@/lib/supabasePhotos";
import PhotoDetailModal from "./PhotoDetailModal";

interface PhotoGalleryVirtualizedProps {
  timeline: PhotoTimelineItem[];
  employeeName: string;
}

type FlattenedPhoto = {
  photo: PhotoRecord;
  type: "check-in" | "check-out";
  dayLabel: string;
  dayOfWeek: string;
};

export default function PhotoGalleryVirtualized({ timeline, employeeName }: PhotoGalleryVirtualizedProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [columnCount, setColumnCount] = useState(3);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [isMounted, setIsMounted] = useState(false);

  // Flatten all photos into a single array for virtual scrolling
  const allPhotos = useMemo(() => {
    const flattened: FlattenedPhoto[] = [];

    timeline.forEach((item) => {
      const photosWithUrl = item.photos.filter(photo => photo.photoPublicUrl);

      photosWithUrl.forEach((photo) => {
        flattened.push({
          photo,
          type: photo.status as "check-in" | "check-out",
          dayLabel: item.dayLabel,
          dayOfWeek: item.dayOfWeek,
        });
      });
    });

    return flattened;
  }, [timeline]);

  // Responsive column counts
  const getColumnCount = () => {
    if (typeof window === 'undefined') return 3;
    const width = window.innerWidth;
    if (width >= 1536) return 7; // 2xl
    if (width >= 1280) return 6; // xl
    if (width >= 1024) return 5; // lg
    if (width >= 768) return 4;  // md
    if (width >= 640) return 3;  // sm
    return 2; // default
  };

  // Update dimensions on mount and resize
  useEffect(() => {
    setIsMounted(true);

    const updateDimensions = () => {
      setColumnCount(getColumnCount());
      setContainerWidth(window.innerWidth - 40);
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handlePhotoClick = (photo: PhotoRecord | null) => {
    if (photo && photo.photoPublicUrl) {
      setSelectedPhoto(photo);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedPhoto(null), 200);
  };

  if (allPhotos.length === 0) {
    return (
      <div className="bg-white rounded-sm border border-slate-300 p-16 text-center">
        <div className="w-20 h-20 bg-slate-100 mx-auto mb-4 flex items-center justify-center">
          <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1 uppercase tracking-wide">ไม่พบภาพถ่าย</h3>
        <p className="text-sm text-slate-600">ไม่มีภาพถ่ายในช่วงที่เลือก</p>
      </div>
    );
  }

  // Prevent hydration mismatch - only render Grid after mount
  if (!isMounted) {
    return (
      <div className="bg-white rounded-sm border border-slate-300 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-emerald-600 text-white rounded-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">แกลเลอรีภาพ</h3>
                <p className="text-xs text-slate-600">แสดง {allPhotos.length.toLocaleString()} รูปภาพ</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 bg-white px-2 py-1 border border-slate-200 rounded">
              ⚡ Virtual Scrolling
            </div>
          </div>
        </div>
        <div className="p-16 text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-slate-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  const columnWidth = Math.floor(containerWidth / columnCount);
  const rowHeight = Math.floor(columnWidth * 4 / 3); // 3:4 aspect ratio
  const rowCount = Math.ceil(allPhotos.length / columnCount);

  // Calculate container height (show 3 rows initially, max 800px)
  const containerHeight = Math.min(rowHeight * 3, 800);

  // Cell component for Grid
  const Cell = ({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
    const index = rowIndex * columnCount + columnIndex;

    if (index >= allPhotos.length) {
      return null;
    }

    const item = allPhotos[index];
    const { photo, type, dayLabel, dayOfWeek } = item;

    const isCheckIn = type === "check-in";
    const borderColor = isCheckIn ? "border-emerald-400" : "border-sky-400";
    const bgColor = isCheckIn ? "bg-emerald-600" : "bg-sky-600";
    const label = isCheckIn ? "เข้างาน" : "ออกงาน";

    return (
      <div style={style} className="p-2">
        <div
          className={`relative aspect-[3/4] bg-white border-2 ${borderColor} overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group`}
          onClick={() => handlePhotoClick(photo)}
        >
          {/* Photo */}
          {photo.photoPublicUrl && (
            <Image
              src={photo.photoPublicUrl}
              alt={`${employeeName} - ${label} - ${dayLabel}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
              loading="lazy"
            />
          )}

          {/* Top badge - Type */}
          <div className={`absolute top-2 left-2 ${bgColor} px-2 py-1 flex items-center gap-1`}>
            <div className="w-1.5 h-1.5 bg-white"></div>
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">{label}</span>
          </div>

          {/* Bottom info overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2">
            <div className="space-y-1">
              {/* Date row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center justify-center w-5 h-5 bg-white/20 backdrop-blur-sm text-[10px] font-bold text-white">
                    {dayOfWeek}
                  </div>
                  <span className="text-xs font-bold text-white">{dayLabel}</span>
                </div>
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-1.5 py-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                  </svg>
                  <span className="text-[10px] font-bold text-white font-mono">{photo.recordedTime}</span>
                </div>
              </div>

              {/* Store info */}
              <div className="flex items-center gap-1 text-[10px] text-white/90 truncate">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="truncate">{photo.storeName || "ไม่ระบุร้าน"}</span>
              </div>

              {/* GPS coordinates */}
              {photo.latitude && photo.longitude && (
                <div className="text-[9px] font-mono text-white/70 truncate">
                  {photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)}
                </div>
              )}
            </div>
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white px-3 py-1.5 border border-slate-900">
              <span className="text-xs font-semibold text-slate-900 uppercase tracking-wide">ดูรายละเอียด</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="bg-white rounded-sm border border-slate-300 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-emerald-600 text-white rounded-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">แกลเลอรีภาพ</h3>
                <p className="text-xs text-slate-600">แสดง {allPhotos.length.toLocaleString()} รูปภาพ</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 bg-white px-2 py-1 border border-slate-200 rounded">
              ⚡ Virtual Scrolling
            </div>
          </div>
        </div>

        <Grid
          columnCount={columnCount}
          columnWidth={columnWidth}
          height={containerHeight}
          rowCount={rowCount}
          rowHeight={rowHeight}
          width={containerWidth}
          className="scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
        >
          {Cell}
        </Grid>
      </div>

      {selectedPhoto && (
        <PhotoDetailModal
          photo={selectedPhoto}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
