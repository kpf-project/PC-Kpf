"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { haversineDistance, bearingBetween, bearingToCompass } from "@/lib/geo";

// Dynamic import for MapView to avoid SSR issues
const MapView = dynamic(() => import("./GeofenceGuideMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] w-full overflow-hidden rounded-3xl border border-slate-200 shadow-inner bg-slate-50 relative">
      <div className="absolute inset-0 z-10 flex h-full flex-col items-center justify-center gap-3 bg-slate-50 text-sm text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
        <p>กำลังโหลดแผนที่...</p>
      </div>
    </div>
  ),
});

type GeofenceGuideProps = {
  store: {
    name: string;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    radius?: number | null;
  };
  isOpen: boolean;
  onClose: () => void;
};

type UserPosition = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp: number;
};

const DEFAULT_RADIUS = 100;

export default function GeofenceGuide({ store, isOpen, onClose }: GeofenceGuideProps) {
  console.log('[GeofenceGuide] Component function called with isOpen:', isOpen);

  const [locationError, setLocationError] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('[GeofenceGuide] useEffect - isOpen:', isOpen);
    if (isOpen) {
      console.log('[GeofenceGuide] Modal opened with store:', store);
      console.log('[GeofenceGuide] Store coords:', { lat: store.latitude, lng: store.longitude });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, store.name, store.address, store.latitude, store.longitude]);

  const storeCoords = useMemo(() => {
    if (
      typeof store.latitude === "number" &&
      Number.isFinite(store.latitude) &&
      typeof store.longitude === "number" &&
      Number.isFinite(store.longitude)
    ) {
      return {
        latitude: store.latitude,
        longitude: store.longitude,
      };
    }
    return null;
  }, [store.latitude, store.longitude]);

  // Watch user location
  useEffect(() => {
    if (!isOpen) return;
    if (!navigator.geolocation) {
      setLocationError("อุปกรณ์ของคุณไม่รองรับการแชร์พิกัด");
      return;
    }
    setLocationError(null);
    setIsLocating(true);

    const watcherId = navigator.geolocation.watchPosition(
      (position) => {
        setIsLocating(false);
        setLocationError(null);
        setUserPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("กรุณาอนุญาตการเข้าถึงตำแหน่งเพื่อดูแผนที่");
            break;
          case error.TIMEOUT:
            setLocationError("การดึงตำแหน่งใช้เวลานานเกินไป กรุณาลองใหม่");
            break;
          default:
            setLocationError("ไม่สามารถดึงตำแหน่งได้ กรุณาลองใหม่");
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watcherId);
    };
  }, [isOpen]);

  const distanceInfo = useMemo(() => {
    if (!storeCoords || !userPosition) {
      return null;
    }
    const distance = Math.round(
      haversineDistance(
        { latitude: userPosition.latitude, longitude: userPosition.longitude },
        storeCoords,
      ),
    );
    const bearing = bearingBetween(
      { latitude: userPosition.latitude, longitude: userPosition.longitude },
      storeCoords,
    );
    const direction = bearingToCompass(bearing);
    return {
      distance,
      direction,
      bearing,
    };
  }, [storeCoords, userPosition]);

  const googleMapsLink = useMemo(() => {
    if (!storeCoords) return null;
    if (userPosition) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userPosition.latitude},${userPosition.longitude}&destination=${storeCoords.latitude},${storeCoords.longitude}&travelmode=walking`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${storeCoords.latitude},${storeCoords.longitude}`;
  }, [storeCoords, userPosition]);

  const handleClose = useCallback(() => {
    console.log('[GeofenceGuide] handleClose called!');
    onClose();
  }, [onClose]);

  useEffect(() => {
    console.log('[GeofenceGuide] isOpen changed to:', isOpen);
  }, [isOpen]);

  if (!isOpen) {
    console.log('[GeofenceGuide] Not rendering (isOpen=false)');
    return null;
  }

  console.log('[GeofenceGuide] Rendering modal...');

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm">
      {/* Backdrop - clickable area to close */}
      <div
        className="absolute inset-0"
        onClick={() => {
          console.log('[GeofenceGuide] Backdrop clicked - closing');
          handleClose();
        }}
      />

      {/* Modal content - prevents backdrop click */}
      <div className="absolute inset-0 flex flex-col justify-end pointer-events-none pb-safe">
        <div
          className="relative max-h-[85vh] w-full rounded-t-[32px] bg-white shadow-2xl pointer-events-auto overflow-y-auto"
          onClick={(e) => {
            console.log('[GeofenceGuide] Modal content clicked - NOT closing');
            e.stopPropagation();
          }}
        >
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500">
                แผนที่นำทาง
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{store.name}</h2>
              {store.address && (
                <p className="text-xs text-slate-500">{store.address}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              ปิด
            </button>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <span className="mt-0.5">ℹ️</span>
            <p>
              <strong>จุดสีเขียว</strong> = ร้านที่ต้องไปเช็คอิน • <strong>จุดสีน้ำเงิน</strong> = ตำแหน่งของคุณ • <strong>วงกลมสีเขียว</strong> = รัศมีที่อนุญาต
            </p>
          </div>
        </div>

        <div className="space-y-4 px-6 py-4 pb-20 sm:pb-8">
          {!storeCoords ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-600">
              ร้านนี้ยังไม่มีการตั้งค่าพิกัดบนแผนที่ กรุณาติดต่อผู้ดูแลระบบ
            </div>
          ) : (
            <>
              {/* Map Component */}
              <MapView
                storeCoords={storeCoords}
                storeName={store.name}
                storeAddress={store.address}
                storeRadius={store.radius ?? DEFAULT_RADIUS}
                userPosition={userPosition}
              />

              <div className="grid grid-cols-2 gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <div>
                  <p className="font-semibold text-slate-800">สถานะพิกัด</p>
                  {locationError ? (
                    <p className="mt-1 text-red-500">{locationError}</p>
                  ) : userPosition ? (
                    <p className="mt-1">
                      รับสัญญาณ {new Date(userPosition.timestamp).toLocaleTimeString("th-TH")}
                    </p>
                  ) : (
                    <p className="mt-1 text-slate-500">
                      {isLocating ? "กำลังค้นหาตำแหน่ง..." : "ยังไม่ได้รับพิกัด"}
                    </p>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">ความแม่นยำ</p>
                  {userPosition?.accuracy ? (
                    <p className="mt-1">±{Math.round(userPosition.accuracy)} เมตร</p>
                  ) : (
                    <p className="mt-1 text-slate-500">—</p>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">ระยะห่าง</p>
                  {distanceInfo ? (
                    <p className="mt-1">
                      {distanceInfo.distance} เมตร
                    </p>
                  ) : (
                    <p className="mt-1 text-slate-500">—</p>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">ทิศทาง</p>
                  {distanceInfo ? (
                    <p className="mt-1">
                      {distanceInfo.direction} ({Math.round(distanceInfo.bearing)}°)
                    </p>
                  ) : (
                    <p className="mt-1 text-slate-500">—</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={
                    googleMapsLink ??
                    `https://www.google.com/maps/search/?api=1&query=${storeCoords.latitude},${storeCoords.longitude}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
                >
                  เปิดใน Google Maps
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
