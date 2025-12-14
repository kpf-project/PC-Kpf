"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import dayjs from "dayjs";
import "dayjs/locale/th";

type PCShelfPhoto = {
  id: string;
  report_id: string;
  photo_url: string;
  storage_path: string;
  caption: string | null;
  uploaded_at: string;
  created_at: string;
};

type Props = {
  photos: PCShelfPhoto[];
};

export function ShelfPhotosGallery({ photos }: Props) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  const openLightbox = useCallback((index: number) => {
    setSelectedPhotoIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setSelectedPhotoIndex(null);
  }, []);

  const nextPhoto = useCallback(() => {
    if (selectedPhotoIndex === null) return;
    setSelectedPhotoIndex((prev) => (prev === null ? 0 : (prev + 1) % photos.length));
  }, [selectedPhotoIndex, photos.length]);

  const prevPhoto = useCallback(() => {
    if (selectedPhotoIndex === null) return;
    setSelectedPhotoIndex((prev) =>
      prev === null ? 0 : (prev - 1 + photos.length) % photos.length
    );
  }, [selectedPhotoIndex, photos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPhotoIndex === null) return;

      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowRight") {
        nextPhoto();
      } else if (e.key === "ArrowLeft") {
        prevPhoto();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPhotoIndex, closeLightbox, nextPhoto, prevPhoto]);

  if (photos.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
        ไม่มีรูปถ่าย
      </div>
    );
  }

  return (
    <>
      {/* Photo Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => {
          const uploadTime = dayjs(photo.uploaded_at).locale('th').format("HH:mm");

          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => openLightbox(index)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Image
                src={photo.photo_url}
                alt={photo.caption || `รูปที่ ${index + 1}`}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition group-hover:scale-105"
              />
              {/* Overlay with time */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-xs font-medium text-white">{uploadTime}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {selectedPhotoIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={closeLightbox}
        >
          <div className="relative max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute -right-2 -top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl text-slate-700 shadow-lg transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="ปิด"
            >
              ×
            </button>

            {/* Previous button */}
            {photos.length > 1 && (
              <button
                type="button"
                onClick={prevPhoto}
                className="absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl text-slate-700 shadow-lg transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="รูปก่อนหน้า"
              >
                ‹
              </button>
            )}

            {/* Next button */}
            {photos.length > 1 && (
              <button
                type="button"
                onClick={nextPhoto}
                className="absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl text-slate-700 shadow-lg transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="รูปถัดไป"
              >
                ›
              </button>
            )}

            {/* Image */}
            <div className="relative h-[80vh] w-full overflow-hidden rounded-lg bg-white">
              <Image
                src={photos[selectedPhotoIndex].photo_url}
                alt={photos[selectedPhotoIndex].caption || `รูปที่ ${selectedPhotoIndex + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>

            {/* Caption & Info */}
            <div className="mt-4 rounded-lg bg-white p-4 shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {photos[selectedPhotoIndex].caption && (
                    <p className="text-sm font-medium text-slate-800">
                      {photos[selectedPhotoIndex].caption}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    อัพโหลดเวลา:{" "}
                    {dayjs(photos[selectedPhotoIndex].uploaded_at).locale('th').format("HH:mm น.")}
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  {selectedPhotoIndex + 1} / {photos.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
