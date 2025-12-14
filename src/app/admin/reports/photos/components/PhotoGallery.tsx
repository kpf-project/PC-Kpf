"use client";

import { useState } from "react";
import Image from "next/image";
import type { PhotoTimelineItem, PhotoRecord } from "@/lib/supabasePhotos";
import PhotoDetailModal from "./PhotoDetailModal";

interface PhotoGalleryProps {
  timeline: PhotoTimelineItem[];
  employeeName: string;
}

export default function PhotoGallery({ timeline, employeeName }: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  // Filter only days with photos - UPDATED: check item.photos array
  const daysWithPhotos = timeline.filter(
    (item) => item.photos.some(photo => photo.photoPublicUrl)
  );

  if (daysWithPhotos.length === 0) {
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

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
        {daysWithPhotos.flatMap((item) => {
          // UPDATED: Show ALL photos from item.photos array
          const photosWithType = item.photos
            .filter(photo => photo.photoPublicUrl) // Only photos with images
            .map(photo => ({
              photo,
              type: photo.status as "check-in" | "check-out"
            }));

          return photosWithType.map(({ photo, type }) => (
            <GalleryCard
              key={photo.id}
              photo={photo}
              type={type}
              dayLabel={item.dayLabel}
              dayOfWeek={item.dayOfWeek}
              employeeName={employeeName}
              onClick={() => handlePhotoClick(photo)}
            />
          ));
        })}
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

interface GalleryCardProps {
  photo: PhotoRecord;
  type: "check-in" | "check-out";
  dayLabel: string;
  dayOfWeek: string;
  employeeName: string;
  onClick: () => void;
}

function GalleryCard({ photo, type, dayLabel, dayOfWeek, employeeName, onClick }: GalleryCardProps) {
  const isCheckIn = type === "check-in";
  const borderColor = isCheckIn ? "border-emerald-400" : "border-sky-400";
  const bgColor = isCheckIn ? "bg-emerald-600" : "bg-sky-600";
  const label = isCheckIn ? "เข้างาน" : "ออกงาน";

  return (
    <div
      className={`relative aspect-[3/4] bg-white border-2 ${borderColor} overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group print:break-inside-avoid`}
      onClick={onClick}
    >
      {/* Photo */}
      {photo.photoPublicUrl && (
        <Image
          src={photo.photoPublicUrl}
          alt={`${employeeName} - ${label} - ${dayLabel}`}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
          priority={false}
          loading="lazy"
          placeholder="empty"
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
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center print:hidden">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white px-3 py-1.5 border border-slate-900">
          <span className="text-xs font-semibold text-slate-900 uppercase tracking-wide">ดูรายละเอียด</span>
        </div>
      </div>
    </div>
  );
}
