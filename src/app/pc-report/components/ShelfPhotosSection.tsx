/**
 * Shelf Photos Section Component
 *
 * Allows users to upload and manage multiple shelf photos (max 10)
 * Each photo can have an optional caption
 */

"use client";

import { useState } from "react";
import Image from "next/image";

export type ShelfPhoto = {
  id?: string; // มีถ้าโหลดจาก database แล้ว
  file?: File; // ถ้ายังไม่ได้ upload
  photoUrl?: string; // ถ้า upload แล้ว
  storagePath?: string;
  caption: string;
  uploadedAt: string;
  uploading?: boolean;
  error?: string;
};

type ShelfPhotosSectionProps = {
  photos: ShelfPhoto[];
  onChange: (photos: ShelfPhoto[]) => void;
  onUpload: (file: File) => Promise<{ photoUrl: string; storagePath: string }>;
  disabled?: boolean;
  maxPhotos?: number;
};

export default function ShelfPhotosSection({
  photos,
  onChange,
  onUpload,
  disabled = false,
  maxPhotos = 10,
}: ShelfPhotosSectionProps) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: ShelfPhoto[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check file type
      if (!file.type.startsWith("image/")) {
        continue;
      }

      // Check if we're at max photos
      if (photos.length + newPhotos.length >= maxPhotos) {
        alert(`สามารถอัปโหลดได้สูงสุด ${maxPhotos} รูปเท่านั้น`);
        break;
      }

      newPhotos.push({
        file,
        caption: "",
        uploadedAt: new Date().toISOString(),
        uploading: false,
      });
    }

    if (newPhotos.length > 0) {
      const updatedPhotosArray = [...photos, ...newPhotos];
      onChange(updatedPhotosArray);

      // Auto-upload each new photo sequentially
      const startIndex = photos.length;
      (async () => {
        for (let i = 0; i < newPhotos.length; i++) {
          const photoIndex = startIndex + i;
          await handleUploadPhotoByIndex(photoIndex, updatedPhotosArray);
        }
      })();
    }

    // Reset input
    event.target.value = "";
  };

  // Upload photo using the provided array (for sequential uploads after adding new photos)
  const handleUploadPhotoByIndex = async (index: number, photosArray: ShelfPhoto[]) => {
    const photo = photosArray[index];
    if (!photo || !photo.file || photo.uploading || photo.photoUrl) return;

    setUploadingIndex(index);
    const updatedPhotos = [...photosArray];
    updatedPhotos[index] = { ...photo, uploading: true, error: undefined };
    onChange(updatedPhotos);

    try {
      const result = await onUpload(photo.file);
      const finalPhotos = [...updatedPhotos];
      finalPhotos[index] = {
        ...photo,
        photoUrl: result.photoUrl,
        storagePath: result.storagePath,
        uploading: false,
        file: undefined,
      };
      onChange(finalPhotos);
    } catch (error) {
      const finalPhotos = [...updatedPhotos];
      finalPhotos[index] = {
        ...photo,
        uploading: false,
        error: error instanceof Error ? error.message : "อัปโหลดล้มเหลว",
      };
      onChange(finalPhotos);
    } finally {
      setUploadingIndex(null);
    }
  };

  // Upload photo using current photos state (for manual retry)
  const handleUploadPhoto = async (index: number) => {
    await handleUploadPhotoByIndex(index, photos);
  };

  const handleCaptionChange = (index: number, caption: string) => {
    const updatedPhotos = [...photos];
    updatedPhotos[index] = { ...updatedPhotos[index], caption };
    onChange(updatedPhotos);
  };

  const handleDeletePhoto = (index: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    onChange(updatedPhotos);
  };

  const handleRetryUpload = (index: number) => {
    handleUploadPhoto(index);
  };

  const canAddMore = photos.length < maxPhotos;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          📸 รูปชั้นวาง
        </h2>
        <span className="text-sm text-gray-600">
          {photos.length} / {maxPhotos} รูป
        </span>
      </div>

      {photos.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-600">ยังไม่มีรูปภาพ</p>
          <p className="text-sm text-gray-500 mt-1">
            คลิกปุ่มด้านล่างเพื่อเพิ่มรูป
          </p>
        </div>
      )}

      <div className="space-y-4">
        {photos.map((photo, index) => (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            <div className="relative w-full aspect-square bg-gray-100">
              {photo.uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                  <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p className="text-sm">กำลังอัปโหลด...</p>
                  </div>
                </div>
              )}

              {photo.error && (
                <div className="absolute inset-0 bg-red-50 flex items-center justify-center z-10">
                  <div className="text-center p-4">
                    <p className="text-red-600 text-sm mb-2">{photo.error}</p>
                    <button
                      onClick={() => handleRetryUpload(index)}
                      className="text-sm text-red-600 underline"
                      disabled={disabled}
                    >
                      ลองอีกครั้ง
                    </button>
                  </div>
                </div>
              )}

              {photo.file && !photo.photoUrl && !photo.uploading && (
                <Image
                  src={URL.createObjectURL(photo.file)}
                  alt={`รูปชั้นวางที่ ${index + 1}`}
                  fill
                  className="object-cover"
                />
              )}

              {photo.photoUrl && (
                <Image
                  src={photo.photoUrl}
                  alt={`รูปชั้นวางที่ ${index + 1}`}
                  fill
                  className="object-cover"
                />
              )}

              {!photo.file && !photo.photoUrl && !photo.uploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-gray-400">ไม่มีรูปภาพ</p>
                </div>
              )}
            </div>

            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {new Date(photo.uploadedAt).toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {photo.photoUrl && (
                  <span className="text-green-600 flex items-center gap-1">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    อัปโหลดแล้ว
                  </span>
                )}
              </div>

              <input
                type="text"
                value={photo.caption}
                onChange={(e) => handleCaptionChange(index, e.target.value)}
                placeholder="คำอธิบายรูป (ถ้ามี)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={disabled || photo.uploading}
              />

              <button
                onClick={() => handleDeletePhoto(index)}
                className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                disabled={disabled || photo.uploading}
              >
                ลบรูปนี้
              </button>
            </div>
          </div>
        ))}
      </div>

      {canAddMore && (
        <label
          className={`block w-full py-4 text-center border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
            disabled
              ? "border-gray-300 bg-gray-50 text-gray-400 cursor-not-allowed"
              : "border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            disabled={disabled || uploadingIndex !== null}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-2">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="font-medium">+ เพิ่มรูปอีก</span>
            <span className="text-sm">
              (เหลืออีก {maxPhotos - photos.length} รูป)
            </span>
          </div>
        </label>
      )}

      {!canAddMore && (
        <div className="text-center py-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            ครบ {maxPhotos} รูปแล้ว ลบรูปเดิมเพื่อเพิ่มรูปใหม่
          </p>
        </div>
      )}
    </section>
  );
}
