/**
 * Promotion Section Component
 *
 * Allows users to upload photos and add notes for promotions
 * Used for both competitor and store promotions
 */

"use client";

import { useState } from "react";
import Image from "next/image";

type PromotionSectionProps = {
  title: string;
  icon: string;
  photos: string[]; // Array of photo URLs
  notes: string;
  onPhotosChange: (photos: string[]) => void;
  onNotesChange: (notes: string) => void;
  onUpload: (file: File) => Promise<{ photoUrl: string; storagePath: string }>;
  disabled?: boolean;
  placeholder?: string;
};

export default function PromotionSection({
  title,
  icon,
  photos,
  notes,
  onPhotosChange,
  onNotesChange,
  onUpload,
  disabled = false,
  placeholder = "บันทึกรายละเอียด...",
}: PromotionSectionProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const uploadPromises = Array.from(files).map((file) => onUpload(file));
      const results = await Promise.all(uploadPromises);
      const newPhotoUrls = results.map((r) => r.photoUrl);
      onPhotosChange([...photos, ...newPhotoUrls]);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("อัปโหลดรูปล้มเหลว กรุณาลองใหม่อีกครั้ง");
    } finally {
      setUploading(false);
      event.target.value = ""; // Reset input
    }
  };

  const handleDeletePhoto = (index: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(updatedPhotos);
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        {icon} {title}
      </h2>

      {/* Photos */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          รูปภาพ
        </label>

        {photos.length === 0 && !uploading && (
          <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 mb-3">
            <p className="text-sm text-gray-500">ยังไม่มีรูปภาพ</p>
          </div>
        )}

        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            {photos.map((photoUrl, index) => (
              <div
                key={index}
                className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden"
              >
                <Image
                  src={photoUrl}
                  alt={`${title} รูปที่ ${index + 1}`}
                  fill
                  className="object-cover"
                />
                <button
                  onClick={() => handleDeletePhoto(index)}
                  disabled={disabled}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-700 disabled:opacity-50 shadow-lg"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {uploading && (
          <div className="text-center py-4 bg-blue-50 rounded-lg border border-blue-200 mb-3">
            <div className="inline-flex items-center gap-2 text-blue-600">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-sm font-medium">กำลังอัปโหลด...</span>
            </div>
          </div>
        )}

        <label
          className={`block w-full py-3 text-center border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
            disabled || uploading
              ? "border-gray-300 bg-gray-50 text-gray-400 cursor-not-allowed"
              : "border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            disabled={disabled || uploading}
            className="hidden"
          />
          <div className="flex items-center justify-center gap-2">
            <svg
              className="w-6 h-6"
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
            <span className="font-medium">เพิ่มรูป</span>
          </div>
        </label>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          บันทึกรายละเอียด
        </label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={placeholder}
          rows={6}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-50"
        />
        <p className="text-xs text-gray-500 mt-1">
          {notes.length} ตัวอักษร
        </p>
      </div>
    </section>
  );
}
