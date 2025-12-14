"use client";

import { useState } from "react";
import Image from "next/image";
import type { PhotoTimelineItem, PhotoRecord } from "@/lib/supabasePhotos";
import PhotoDetailModal from "./PhotoDetailModal";

interface PhotoTimelineProps {
  timeline: PhotoTimelineItem[];
  employeeName: string;
}

export default function PhotoTimeline({ timeline, employeeName }: PhotoTimelineProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handlePhotoClick = (photo: PhotoRecord | null) => {
    if (photo) {
      setSelectedPhoto(photo);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedPhoto(null), 200);
  };

  if (timeline.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-blue-200/50 shadow-xl p-12 sm:p-16 text-center">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl mx-auto mb-6 flex items-center justify-center">
          <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-blue-900 mb-2">ไม่พบข้อมูล</h3>
        <p className="text-sm sm:text-base text-blue-600">ไม่มีข้อมูลการลงเวลาในช่วงที่เลือก</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
        {timeline.map((item) => (
          <TimelineRow
            key={item.date}
            item={item}
            employeeName={employeeName}
            onPhotoClick={handlePhotoClick}
          />
        ))}
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

interface TimelineRowProps {
  item: PhotoTimelineItem;
  employeeName: string;
  onPhotoClick: (photo: PhotoRecord | null) => void;
}

function TimelineRow({ item, employeeName, onPhotoClick }: TimelineRowProps) {
  const hasData = item.hasCheckIn || item.hasCheckOut;
  const completionRate = hasData
    ? Math.round(
        (([item.checkInPhoto?.photoPublicUrl, item.checkOutPhoto?.photoPublicUrl].filter(Boolean).length) /
          ([item.hasCheckIn, item.hasCheckOut].filter(Boolean).length)) *
          100
      )
    : 0;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl border border-blue-200/50 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
      {/* Date Header Row */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Date Info */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border-2 border-white/30">
              <span className="text-xl sm:text-2xl font-bold text-white">{item.dayLabel.split(" ")[0]}</span>
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold text-white">{item.dayLabel}</div>
              <div className="text-xs sm:text-sm text-blue-100 font-mono mt-0.5">{item.date}</div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3 sm:gap-4 ml-auto sm:ml-0">
            {hasData && (
              <div className="text-right bg-white/20 backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2 border border-white/30">
                <div className="text-[10px] sm:text-xs text-blue-100 font-semibold">ความครบถ้วน</div>
                <div className="text-lg sm:text-xl font-bold text-white">{completionRate}%</div>
              </div>
            )}
            <StatusBadge item={item} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6">
        {!hasData ? (
          <div className="py-8 sm:py-12 text-center text-blue-400">
            <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <div className="text-sm sm:text-base font-semibold">ไม่มีข้อมูลการลงเวลา</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Show ALL photos for this date, sorted by time */}
            {item.photos.map((photo, index) => (
              <PhotoBlock
                key={photo.id}
                photo={photo}
                type={photo.status as "check-in" | "check-out"}
                employeeName={employeeName}
                onClick={() => onPhotoClick(photo)}
                showIndex={item.photos.length > 2}
                index={index + 1}
                totalPhotos={item.totalPhotos}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  item: PhotoTimelineItem;
}

function StatusBadge({ item }: StatusBadgeProps) {
  if (!item.hasCheckIn && !item.hasCheckOut) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:py-2 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
        <div className="w-2 h-2 bg-white rounded-full"></div>
        <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide">ว่าง</span>
      </div>
    );
  }

  const hasPhoto = !!item.checkInPhoto?.photoPublicUrl || !!item.checkOutPhoto?.photoPublicUrl;
  const isMissing = item.missingPhotos.length > 0;

  if (isMissing) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:py-2 bg-amber-500 rounded-xl shadow-lg">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide">ไม่ครบ</span>
      </div>
    );
  }

  if (hasPhoto) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:py-2 bg-emerald-500 rounded-xl shadow-lg">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide">ครบ</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:py-2 bg-rose-500 rounded-xl shadow-lg">
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
      <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide">ไม่มีภาพ</span>
    </div>
  );
}

interface PhotoBlockProps {
  photo: PhotoRecord | null;
  type: "check-in" | "check-out";
  employeeName: string;
  onClick: () => void;
  showIndex?: boolean;
  index?: number;
  totalPhotos?: number;
}

function PhotoBlock({ photo, type, employeeName, onClick, showIndex = false, index, totalPhotos }: PhotoBlockProps) {
  const hasPhoto = !!photo?.photoPublicUrl;
  const isCheckIn = type === "check-in";
  const label = isCheckIn ? "เข้างาน" : "ออกงาน";
  const gradient = isCheckIn ? "from-emerald-500 to-teal-500" : "from-blue-500 to-cyan-500";

  return (
    <div className="group bg-white rounded-2xl border-2 border-blue-200 hover:border-blue-400 overflow-hidden transition-all duration-300 hover:shadow-xl">
      {/* Header */}
      <div className={`px-4 py-3 sm:py-3.5 flex items-center justify-between bg-gradient-to-r ${gradient}`}>
        <div className="flex items-center gap-2">
          {showIndex && index && (
            <span className="text-xs font-bold text-white bg-white/30 backdrop-blur-sm px-2 py-0.5 rounded-md">
              {index}/{totalPhotos}
            </span>
          )}
          <div className="w-2 h-2 bg-white rounded-full"></div>
          <span className="text-sm sm:text-base font-bold text-white uppercase tracking-wide">{label}</span>
        </div>
        {photo && (
          <span className="text-xs sm:text-sm font-bold text-white bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg border border-white/30">
            {photo.recordedTime}
          </span>
        )}
      </div>

      {/* Photo */}
      <div
        className={`aspect-[4/5] relative bg-gradient-to-br from-blue-50 to-cyan-50 ${hasPhoto ? "cursor-pointer" : ""}`}
        onClick={hasPhoto ? onClick : undefined}
      >
        {hasPhoto && photo && photo.photoPublicUrl ? (
          <>
            <Image
              src={photo.photoPublicUrl}
              alt={`${employeeName} - ${label}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />

            {/* Info Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 sm:p-4">
              <div className="space-y-1 text-white text-xs sm:text-sm">
                <div className="font-bold">
                  {new Date(`${photo.recordedDate}T${photo.recordedTime}`).toLocaleDateString("th-TH", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                  })}{" "}
                  {photo.recordedTime}
                </div>
                {photo.storeName && <div className="truncate opacity-90">{photo.storeName}</div>}
                {photo.latitude && photo.longitude && (
                  <div className="font-mono text-[10px] sm:text-xs opacity-75">
                    {photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)}
                  </div>
                )}
              </div>
            </div>

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity transform scale-90 group-hover:scale-100 bg-white/95 backdrop-blur-sm px-4 py-2 sm:px-6 sm:py-3 rounded-2xl shadow-2xl border-2 border-blue-500">
                <span className="text-xs sm:text-sm font-bold text-blue-900 uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  ดูรายละเอียด
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-blue-300">
            <div className="text-center">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="text-xs sm:text-sm font-bold uppercase tracking-wide">ไม่มีภาพ</div>
            </div>
          </div>
        )}
      </div>

      {/* Details */}
      {photo && (
        <div className="px-4 py-3 bg-gradient-to-br from-blue-50 to-cyan-50 border-t-2 border-blue-200">
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between">
              <span className="text-blue-600 font-semibold">ร้าน</span>
              <span className="text-blue-900 font-bold">{photo.storeName || "—"}</span>
            </div>
            {photo.latitude && photo.longitude && (
              <div className="flex items-center justify-between">
                <span className="text-blue-600 font-semibold">พิกัด</span>
                <span className="text-blue-900 font-mono text-[10px] sm:text-xs">
                  {photo.latitude.toFixed(6)}, {photo.longitude.toFixed(6)}
                </span>
              </div>
            )}
            {photo.accuracy !== null && (
              <div className="flex items-center justify-between">
                <span className="text-blue-600 font-semibold">ความแม่นยำ</span>
                <span className="text-blue-900 font-bold">±{photo.accuracy.toFixed(0)} ม.</span>
              </div>
            )}
            {photo.note && (
              <div className="pt-2 border-t border-blue-200">
                <div className="text-blue-600 font-semibold mb-1">หมายเหตุ</div>
                <div className="text-blue-900 leading-relaxed">{photo.note}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface EmptyBlockProps {
  type: "check-in" | "check-out";
}

// Legacy component - no longer used with multi-photo display
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function EmptyBlock({ type }: EmptyBlockProps) {
  const isCheckIn = type === "check-in";
  const label = isCheckIn ? "เข้างาน" : "ออกงาน";
  const gradient = isCheckIn ? "from-gray-400 to-gray-500" : "from-gray-400 to-gray-500";

  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 overflow-hidden opacity-60">
      <div className={`px-4 py-3 bg-gradient-to-r ${gradient}`}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-white rounded-full opacity-50"></div>
          <span className="text-sm sm:text-base font-bold text-white uppercase tracking-wide">{label}</span>
        </div>
      </div>
      <div className="aspect-[4/5] flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 rounded-2xl mx-auto mb-3 flex items-center justify-center">
            <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="text-xs sm:text-sm font-bold uppercase tracking-wide">ไม่มีข้อมูล{label}</div>
        </div>
      </div>
    </div>
  );
}
