"use client";

import { useState } from "react";
import Image from "next/image";

interface BrandingLogoProps {
  src: string;
  alt?: string;
  className?: string;
  placeholderClassName?: string;
}

/**
 * BrandingLogo Component
 * แสดง logo พร้อม placeholder สีเทาขณะโหลด
 * ป้องกันการแสดง cached image เก่าที่ดูแล็ค
 */
export function BrandingLogo({
  src,
  alt = "Company Logo",
  className = "",
  placeholderClassName = "",
}: BrandingLogoProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoaded(true);
    setHasError(true);
  };

  return (
    <div className="relative inline-block">
      {/* Placeholder - แสดงขณะโหลด */}
      {!isLoaded && (
        <div
          className={`animate-pulse bg-slate-200 ${placeholderClassName || className}`}
          style={{ minWidth: "120px", minHeight: "80px" }}
        />
      )}

      {/* รูปจริง - ซ่อนจนกว่าจะโหลดเสร็จ */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 200px"
        className={`${className} ${isLoaded ? "opacity-100" : "opacity-0"} object-contain`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        placeholder="empty"
      />

      {/* แสดงข้อความ error ถ้าโหลดไม่สำเร็จ */}
      {hasError && (
        <div
          className={`flex items-center justify-center bg-slate-100 text-slate-400 text-xs ${className}`}
        >
          Logo ไม่พร้อมใช้งาน
        </div>
      )}
    </div>
  );
}
