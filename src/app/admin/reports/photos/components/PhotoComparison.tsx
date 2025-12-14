"use client";

import { useState } from "react";
import Image from "next/image";
import type { PhotoTimelineItem, PhotoRecord } from "@/lib/supabasePhotos";
import PhotoDetailModal from "./PhotoDetailModal";

interface PhotoComparisonProps {
  timeline: PhotoTimelineItem[];
  employeeName: string;
}

export default function PhotoComparison({ timeline, employeeName }: PhotoComparisonProps) {
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

  // Filter only days with at least one record
  const daysWithRecords = timeline.filter(
    (item) => item.hasCheckIn || item.hasCheckOut
  );

  if (daysWithRecords.length === 0) {
    return (
      <div className="bg-white rounded-sm border border-slate-300 p-16 text-center">
        <div className="w-20 h-20 bg-slate-100 mx-auto mb-4 flex items-center justify-center">
          <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1 uppercase tracking-wide">ไม่พบข้อมูล</h3>
        <p className="text-sm text-slate-600">ไม่มีข้อมูลการลงเวลาในช่วงที่เลือก</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {daysWithRecords.map((item) => (
          <ComparisonRow
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

interface ComparisonRowProps {
  item: PhotoTimelineItem;
  employeeName: string;
  onPhotoClick: (photo: PhotoRecord | null) => void;
}

function ComparisonRow({ item, employeeName, onPhotoClick }: ComparisonRowProps) {
  // UPDATED: Check if we have at least one check-in and one check-out
  const checkIns = item.photos.filter(p => p.status === "check-in");
  const checkOuts = item.photos.filter(p => p.status === "check-out");

  const firstCheckIn = checkIns[0];
  const lastCheckOut = checkOuts[checkOuts.length - 1];

  const workingHours = firstCheckIn && lastCheckOut
    ? calculateWorkingHours(firstCheckIn.recordedTime, lastCheckOut.recordedTime)
    : "";

  const totalPhotos = item.photos.length;
  const photosWithImage = item.photos.filter(p => p.photoPublicUrl).length;

  return (
    <div className="bg-white rounded-sm border border-slate-300 overflow-hidden">
      {/* Date Header Row */}
      <div className="bg-slate-50 border-b border-slate-300 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Date Info */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white border border-slate-400 flex items-center justify-center">
                <span className="text-2xl font-bold text-slate-900">{item.dayLabel.split(" ")[0]}</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{item.dayLabel}</div>
                <div className="text-xs text-slate-600 font-mono mt-0.5">{item.date}</div>
              </div>
            </div>

            {/* Photo count badge */}
            {totalPhotos > 0 && (
              <div className="px-3 py-1 bg-blue-100 border border-blue-300 text-xs font-bold text-blue-900">
                {photosWithImage}/{totalPhotos} รูป
              </div>
            )}
          </div>

          {/* Working Hours */}
          {workingHours && (
            <div className="flex items-center gap-3 px-4 py-2 bg-white border border-slate-400">
              <div className="w-5 h-5 border-2 border-slate-600 flex items-center justify-center">
                <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] text-slate-600 uppercase tracking-widest">ชั่วโมง</div>
                <div className="text-sm font-bold text-slate-900 font-mono">{workingHours}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content - UPDATED: Show ALL photos */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {item.photos.map((photo, index) => (
            <ComparisonPhotoBlock
              key={photo.id}
              photo={photo}
              type={photo.status as "check-in" | "check-out"}
              employeeName={employeeName}
              onClick={() => onPhotoClick(photo)}
              showIndex={totalPhotos > 2}
              index={index + 1}
              totalPhotos={totalPhotos}
            />
          ))}
        </div>

        {/* Warning if photos missing */}
        {photosWithImage < totalPhotos && (
          <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-400">
            <div className="flex items-center gap-2 text-amber-900">
              <div className="w-1.5 h-1.5 bg-amber-600"></div>
              <span className="text-xs font-semibold uppercase tracking-wider">
                ขาดรูปภาพ {totalPhotos - photosWithImage} รายการ
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ComparisonPhotoBlockProps {
  photo: PhotoRecord | null;
  type: "check-in" | "check-out";
  employeeName: string;
  onClick: () => void;
  showIndex?: boolean;
  index?: number;
  totalPhotos?: number;
}

function ComparisonPhotoBlock({ photo, type, employeeName, onClick, showIndex = false, index, totalPhotos }: ComparisonPhotoBlockProps) {
  const hasPhoto = !!photo?.photoPublicUrl;
  const isCheckIn = type === "check-in";
  const label = isCheckIn ? "เข้างาน" : "ออกงาน";
  const borderColor = isCheckIn ? "border-emerald-400" : "border-sky-400";

  if (!photo) {
    return (
      <div className="border border-slate-300 border-dashed bg-slate-50/50">
        <div className="aspect-[4/5] flex items-center justify-center text-slate-400">
          <div className="text-center">
            <div className="w-16 h-16 bg-slate-200 mx-auto mb-3 flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide">ไม่มีข้อมูล{label}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border ${borderColor} bg-white overflow-hidden`}>
      {/* Header */}
      <div className={`px-4 py-2 flex items-center justify-between ${isCheckIn ? "bg-emerald-50" : "bg-sky-50"} border-b ${borderColor}`}>
        <div className="flex items-center gap-2">
          {showIndex && index && (
            <span className="text-xs font-bold text-slate-900 bg-white border border-slate-400 px-2 py-0.5">
              {index}/{totalPhotos}
            </span>
          )}
          <div className={`w-2 h-2 ${isCheckIn ? "bg-emerald-600" : "bg-sky-600"}`}></div>
          <span className="text-sm font-bold text-slate-900 uppercase tracking-wide">{label}</span>
        </div>
        <span className="text-xs font-mono text-slate-700 bg-white px-2 py-0.5 border border-slate-300">
          {photo.recordedTime}
        </span>
      </div>

      {/* Photo */}
      <div
        className={`aspect-[4/5] relative bg-slate-100 ${hasPhoto ? "cursor-pointer" : ""}`}
        onClick={hasPhoto ? onClick : undefined}
      >
        {hasPhoto && photo.photoPublicUrl ? (
          <>
            <Image
              src={photo.photoPublicUrl}
              alt={`${employeeName} - ${label}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 50vw"
            />

            {/* Info Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
              <div className="space-y-1 text-white text-xs">
                <div className="font-mono font-semibold">
                  {new Date(`${photo.recordedDate}T${photo.recordedTime}`).toLocaleDateString("th-TH", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                  })}{" "}
                  {photo.recordedTime}
                </div>
                {photo.storeName && <div className="truncate">{photo.storeName}</div>}
                {photo.latitude && photo.longitude && (
                  <div className="font-mono text-[10px] opacity-80">
                    {photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)}
                  </div>
                )}
              </div>
            </div>

            {/* Hover */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="opacity-0 hover:opacity-100 transition-opacity bg-white/95 px-3 py-1.5 border border-slate-900">
                <span className="text-xs font-semibold text-slate-900 uppercase tracking-wide">ดูรายละเอียด</span>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="text-xs font-semibold uppercase tracking-wide">ไม่มีภาพ</div>
            </div>
          </div>
        )}
      </div>

      {/* Details */}
      {photo && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-300">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-1.5 text-slate-600 font-medium w-24">ร้าน</td>
                <td className="py-1.5 text-slate-900">{photo.storeName || "—"}</td>
              </tr>
              {photo.latitude && photo.longitude && (
                <tr>
                  <td className="py-1.5 text-slate-600 font-medium">พิกัด</td>
                  <td className="py-1.5 text-slate-900 font-mono text-[10px]">
                    {photo.latitude.toFixed(6)}, {photo.longitude.toFixed(6)}
                  </td>
                </tr>
              )}
              {photo.accuracy !== null && (
                <tr>
                  <td className="py-1.5 text-slate-600 font-medium">ความแม่นยำ</td>
                  <td className="py-1.5 text-slate-900">±{photo.accuracy.toFixed(0)} ม.</td>
                </tr>
              )}
              {photo.note && (
                <tr>
                  <td className="py-1.5 text-slate-600 font-medium align-top">หมายเหตุ</td>
                  <td className="py-1.5 text-slate-900 leading-relaxed">{photo.note}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Helper function
function calculateWorkingHours(checkInTime: string, checkOutTime: string): string {
  if (!checkInTime || !checkOutTime) return "";

  try {
    const [inHour, inMinute] = checkInTime.split(":").map(Number);
    const [outHour, outMinute] = checkOutTime.split(":").map(Number);

    if (isNaN(inHour) || isNaN(inMinute) || isNaN(outHour) || isNaN(outMinute)) {
      return "";
    }

    const inMinutes = inHour * 60 + inMinute;
    const outMinutes = outHour * 60 + outMinute;
    const diffMinutes = outMinutes - inMinutes;

    if (diffMinutes <= 0) return "";

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (minutes === 0) {
      return `${hours}:00`;
    }
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  } catch {
    return "";
  }
}
