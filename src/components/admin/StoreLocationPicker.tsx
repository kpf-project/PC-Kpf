"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Circle as LeafletCircle, LeafletMouseEvent } from "leaflet";

export type LocationData = {
  latitude: number;
  longitude: number;
  radius: number;
  address?: string;
};

type NominatimRawResult = {
  lat: string;
  lon: string;
  display_name?: string;
  importance?: number;
  place_rank?: number;
};

type GeocodeCandidate = {
  lat: number;
  lng: number;
  displayName?: string;
  score: number;
};

type StoreLocationPickerProps = {
  initialLocation?: LocationData | null;
  onLocationChange: (location: LocationData | null) => void;
  onClose?: () => void;
};

// Default location: Bangkok, Thailand
const DEFAULT_LAT = 13.7563;
const DEFAULT_LNG = 100.5018;
const DEFAULT_RADIUS = 100;
const MIN_RADIUS = 50;
const MAX_RADIUS = 500;

const formatCoordinates = (lat: number, lng: number) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "";
  }
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

const parseCoordinatePair = (value: string): { lat: number; lng: number } | null => {
  const parts = value.split(",");
  if (parts.length < 2) return null;
  const lat = Number.parseFloat(parts[0]?.trim() ?? "");
  const lng = Number.parseFloat(parts[1]?.trim() ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

export default function StoreLocationPicker({
  initialLocation,
  onLocationChange,
  onClose,
}: StoreLocationPickerProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<LeafletCircle | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const reverseGeocodeRequestRef = useRef(0);
  const isInitializingMapRef = useRef(false);
  const hasSyncedInitialPositionRef = useRef(false);
  const addressGeocodeTimerRef = useRef<number | null>(null);
  const coordinateInputActiveRef = useRef(false);
  const coordinateGeocodeTimerRef = useRef<number | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [location, setLocation] = useState<LocationData>(() => {
    if (initialLocation) {
      return {
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
        radius: initialLocation.radius || DEFAULT_RADIUS,
        address: initialLocation.address,
      };
    }
    return {
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LNG,
      radius: DEFAULT_RADIUS,
    };
  });
  const latestLocationRef = useRef(location);

  useEffect(() => {
    latestLocationRef.current = location;
  }, [location]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [coordinateInput, setCoordinateInput] = useState(() =>
    formatCoordinates(initialLocation?.latitude ?? DEFAULT_LAT, initialLocation?.longitude ?? DEFAULT_LNG),
  );
  const [coordinateError, setCoordinateError] = useState<string | null>(null);

  const applyLocationToMap = useCallback((lat: number, lng: number, newAddress?: string) => {
    if (markerRef.current && circleRef.current && mapRef.current) {
      const latLng: [number, number] = [lat, lng];
      markerRef.current.setLatLng(latLng);
      circleRef.current.setLatLng(latLng);
      mapRef.current.setView(latLng, mapRef.current.getZoom());
    }

    setLocation((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      address: newAddress ?? prev.address,
    }));
  }, []);

  const fetchGeocodeCandidates = useCallback(
    async (query: string, options?: { restrictToThailand?: boolean }) => {
      const params = new URLSearchParams({
        format: "jsonv2",
        limit: "5",
        addressdetails: "0",
        "accept-language": "th",
        q: query,
      });

      if (options?.restrictToThailand !== false) {
        params.set("countrycodes", "th");
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          headers: {
            "Accept-Language": "th",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Nominatim responded with status ${response.status}`);
      }

      const data = (await response.json()) as NominatimRawResult[];
      if (!Array.isArray(data)) {
        return [];
      }

      return data
        .map((item) => {
          const lat = Number.parseFloat(item.lat);
          const lng = Number.parseFloat(item.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
          }
          const importance = item.importance ?? 0;
          const placeRank = item.place_rank ?? 0;
          const score = importance + placeRank / 100;
          return {
            lat,
            lng,
            displayName: item.display_name,
            score,
          } as GeocodeCandidate;
        })
        .filter((candidate): candidate is GeocodeCandidate => Boolean(candidate))
        .sort((a, b) => b.score - a.score);
    },
    [],
  );

  const resolveAddress = useCallback(async (lat: number, lng: number) => {
    const requestId = (reverseGeocodeRequestRef.current += 1);
    setIsResolvingAddress(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`,
        {
          headers: {
            "Accept-Language": "th",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Reverse geocoding request failed");
      }

      const data = await response.json();
      const resolvedAddress =
        typeof data?.display_name === "string" ? (data.display_name as string) : undefined;

      setLocation((prev) => {
        if (reverseGeocodeRequestRef.current !== requestId) {
          return prev;
        }
        return {
          ...prev,
          address: resolvedAddress ?? prev.address,
        };
      });
    } catch (error) {
      console.error("Reverse geocode error:", error);
    } finally {
      if (reverseGeocodeRequestRef.current === requestId) {
        setIsResolvingAddress(false);
      }
    }
  }, []);

  useEffect(() => {
    if (initialLocation && !initialLocation.address) {
      void resolveAddress(initialLocation.latitude, initialLocation.longitude);
    }
  }, [initialLocation, resolveAddress]);

  useEffect(() => {
    return () => {
      if (addressGeocodeTimerRef.current) {
        window.clearTimeout(addressGeocodeTimerRef.current);
      }
      if (coordinateGeocodeTimerRef.current) {
        window.clearTimeout(coordinateGeocodeTimerRef.current);
      }
    };
  }, []);

  // Initialize map
  useEffect(() => {
    let L: typeof import("leaflet") | null = null;
    let map: LeafletMap | null = null;

    const initMap = async () => {
      if (!mapContainerRef.current || mapRef.current || isInitializingMapRef.current) return;
      isInitializingMapRef.current = true;

      try {
        // Dynamically import Leaflet to avoid SSR issues
        L = (await import("leaflet")).default;

        // Import Leaflet CSS
        await import("leaflet/dist/leaflet.css");

        // Fix default marker icon issue with webpack
        const iconPrototype = L.Icon.Default.prototype as unknown as {
          _getIconUrl?: () => string;
        };
        delete iconPrototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        // Initialize map
        const currentLocation = latestLocationRef.current;
        const centerLatitude = currentLocation?.latitude ?? DEFAULT_LAT;
        const centerLongitude = currentLocation?.longitude ?? DEFAULT_LNG;
        const circleRadius = currentLocation?.radius ?? DEFAULT_RADIUS;

        map = L.map(mapContainerRef.current, {
          center: [centerLatitude, centerLongitude],
          zoom: 15,
          zoomControl: true,
        });

        // Add OpenStreetMap tiles
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        // Add marker
        const marker = L.marker([centerLatitude, centerLongitude], {
          draggable: true,
        }).addTo(map);

        // Add circle for geofence radius
        const circle = L.circle([centerLatitude, centerLongitude], {
          radius: circleRadius,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.1,
          weight: 2,
        }).addTo(map);

        // Handle marker drag
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          circle.setLatLng(pos);
          setLocation((prev) => ({
            ...prev,
            latitude: pos.lat,
            longitude: pos.lng,
          }));
          void resolveAddress(pos.lat, pos.lng);
        });

        // Handle map click
        map.on("click", (event: LeafletMouseEvent) => {
          const { latlng } = event;
          marker.setLatLng(latlng);
          circle.setLatLng(latlng);
          setLocation((prev) => ({
            ...prev,
            latitude: latlng.lat,
            longitude: latlng.lng,
          }));
          void resolveAddress(latlng.lat, latlng.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;
        setIsMapReady(true);
      } catch (error) {
        console.error("Failed to initialize map:", error);
      } finally {
        isInitializingMapRef.current = false;
      }
    };

    void initMap();

    // Cleanup
    return () => {
      if (map) {
        map.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
        isInitializingMapRef.current = false;
        hasSyncedInitialPositionRef.current = false;
      }
    };
  }, [resolveAddress]);

  useEffect(() => {
    if (!isMapReady || hasSyncedInitialPositionRef.current) return;
    if (!markerRef.current || !circleRef.current || !mapRef.current) return;

    const latLng: [number, number] = [location.latitude, location.longitude];
    markerRef.current.setLatLng(latLng);
    circleRef.current.setLatLng(latLng);
    mapRef.current.setView(latLng, mapRef.current.getZoom());
    hasSyncedInitialPositionRef.current = true;
  }, [isMapReady, location.latitude, location.longitude]);

  // Update circle radius when location.radius changes
  useEffect(() => {
    if (circleRef.current && isMapReady) {
      circleRef.current.setRadius(location.radius);
    }
  }, [location.radius, isMapReady]);

  useEffect(() => {
    if (coordinateInputActiveRef.current) {
      return;
    }
    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      return;
    }
    setCoordinateInput(formatCoordinates(location.latitude, location.longitude));
    setCoordinateError(null);
  }, [location.latitude, location.longitude]);

  // Search for location using Nominatim (OpenStreetMap geocoding)
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !mapRef.current) return;

    setIsSearching(true);
    try {
      const trimmedQuery = searchQuery.trim();
      let candidates = await fetchGeocodeCandidates(trimmedQuery);

      if (candidates.length === 0 && !/ไทย|thailand/i.test(trimmedQuery)) {
        candidates = await fetchGeocodeCandidates(`${trimmedQuery}, Thailand`, {
          restrictToThailand: false,
        });
      }

      if (candidates.length === 0) {
        alert("ไม่พบตำแหน่งที่ค้นหา กรุณาลองใหม่อีกครั้ง");
        return;
      }

      const [bestCandidate] = candidates;
      applyLocationToMap(bestCandidate.lat, bestCandidate.lng, bestCandidate.displayName);
    } catch (error) {
      console.error("Search error:", error);
      alert("เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSearching(false);
    }
  }, [applyLocationToMap, fetchGeocodeCandidates, searchQuery]);

  const geocodeAddress = useCallback(
    async (inputAddress: string) => {
      const trimmedAddress = inputAddress.trim();
      if (!trimmedAddress) return;

      setIsResolvingAddress(true);
      try {
        let candidates = await fetchGeocodeCandidates(trimmedAddress);

        if (candidates.length === 0 && !/ไทย|thailand/i.test(trimmedAddress)) {
          candidates = await fetchGeocodeCandidates(`${trimmedAddress}, Thailand`, {
            restrictToThailand: false,
          });
        }

        if (candidates.length === 0) {
          alert("ไม่พบตำแหน่งจากที่อยู่ที่ระบุ กรุณาปรับข้อความแล้วลองอีกครั้ง");
          return;
        }

        const [bestCandidate] = candidates;
        applyLocationToMap(
          bestCandidate.lat,
          bestCandidate.lng,
          bestCandidate.displayName ?? trimmedAddress,
        );
      } catch (error) {
        console.error("Forward geocode error:", error);
        alert("ไม่สามารถอัปเดตพิกัดจากที่อยู่นี้ได้ กรุณาลองคำค้นอื่น");
      } finally {
        setIsResolvingAddress(false);
      }
    },
    [applyLocationToMap, fetchGeocodeCandidates],
  );

  // Get current location
  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert("เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        applyLocationToMap(lat, lng);
        void resolveAddress(lat, lng);
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("ไม่สามารถระบุตำแหน่งปัจจุบันได้ กรุณาตรวจสอบการอนุญาตและลองใหม่อีกครั้ง");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }, [applyLocationToMap, resolveAddress]);

  const handleSave = useCallback(() => {
    const trimmedAddress = location.address?.trim();
    onLocationChange({
      latitude: location.latitude,
      longitude: location.longitude,
      radius: location.radius,
      address: trimmedAddress ? trimmedAddress : undefined,
    });
    onClose?.();
  }, [location, onLocationChange, onClose]);

  const handleClear = useCallback(() => {
    onLocationChange(null);
    onClose?.();
  }, [onLocationChange, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl my-4 flex flex-col max-h-[90vh]">
        <div className="border-b border-slate-200 p-5 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">เลือกตำแหน่งร้านค้าบนแผนที่</h2>
          <p className="mt-1 text-sm text-slate-500">
            คลิกบนแผนที่หรือลากเครื่องหมายเพื่อระบุตำแหน่ง
          </p>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1" style={{ touchAction: 'pan-y' }}>
          {/* Search box */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleSearch();
                }
              }}
              placeholder="ค้นหาที่อยู่ เช่น ตลาดจตุจักร กรุงเทพฯ"
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              disabled={isSearching}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSearching ? "กำลังค้นหา..." : "ค้นหา"}
            </button>
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              className="rounded-xl border border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
            >
              ตำแหน่งปัจจุบัน
            </button>
          </div>

          {/* Map container */}
          <div
            ref={mapContainerRef}
            className="h-96 w-full rounded-2xl border border-slate-200 shadow-inner"
            style={{ minHeight: "400px" }}
          />

          {/* Location info */}
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600">
                พิกัดรวม (ละติจูด, ลองจิจูด)
              </label>
              <input
                type="text"
                value={coordinateInput}
                onFocus={() => {
                  coordinateInputActiveRef.current = true;
                }}
                onBlur={() => {
                  coordinateInputActiveRef.current = false;
                  const parsed = parseCoordinatePair(coordinateInput);
                  if (parsed) {
                    setCoordinateError(null);
                    applyLocationToMap(parsed.lat, parsed.lng);
                    setCoordinateInput(formatCoordinates(parsed.lat, parsed.lng));
                    if (coordinateGeocodeTimerRef.current) {
                      window.clearTimeout(coordinateGeocodeTimerRef.current);
                      coordinateGeocodeTimerRef.current = null;
                    }
                    void resolveAddress(parsed.lat, parsed.lng);
                  } else if (coordinateInput.trim() === "") {
                    setCoordinateInput(formatCoordinates(location.latitude, location.longitude));
                    setCoordinateError(null);
                  } else {
                    setCoordinateError("กรุณากรอกในรูปแบบ ละติจูด, ลองจิจูด เช่น 12.34, 100.56");
                  }
                }}
                onChange={(event) => {
                  const { value } = event.target;
                  setCoordinateInput(value);
                  const parsed = parseCoordinatePair(value);
                  if (parsed) {
                    setCoordinateError(null);
                    applyLocationToMap(parsed.lat, parsed.lng);
                    if (coordinateGeocodeTimerRef.current) {
                      window.clearTimeout(coordinateGeocodeTimerRef.current);
                    }
                    coordinateGeocodeTimerRef.current = window.setTimeout(() => {
                      coordinateGeocodeTimerRef.current = null;
                      void resolveAddress(parsed.lat, parsed.lng);
                    }, 800);
                  }
                }}
                placeholder="เช่น 12.686086, 101.268050"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {coordinateError && (
                <p className="mt-1 text-xs text-red-600">{coordinateError}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">พิกัด (Latitude)</label>
              <input
                type="number"
                step="0.000001"
                value={location.latitude}
                onChange={(e) => {
                  const lat = parseFloat(e.target.value);
                  if (!isNaN(lat)) {
                    setLocation((prev) => ({ ...prev, latitude: lat }));
                    if (
                      markerRef.current &&
                      circleRef.current &&
                      mapRef.current &&
                      typeof location.longitude === "number"
                    ) {
                      const newLatLng = [lat, location.longitude] as [number, number];
                      markerRef.current.setLatLng(newLatLng);
                      circleRef.current.setLatLng(newLatLng);
                      mapRef.current.setView(newLatLng, mapRef.current.getZoom());
                    }
                    if (typeof location.longitude === "number") {
                      void resolveAddress(lat, location.longitude);
                    }
                    setCoordinateError(null);
                  }
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">
                พิกัด (Longitude)
              </label>
              <input
                type="number"
                step="0.000001"
                value={location.longitude}
                onChange={(e) => {
                  const lng = parseFloat(e.target.value);
                  if (!isNaN(lng)) {
                    setLocation((prev) => ({ ...prev, longitude: lng }));
                    if (
                      markerRef.current &&
                      circleRef.current &&
                      mapRef.current &&
                      typeof location.latitude === "number"
                    ) {
                      const newLatLng = [location.latitude, lng] as [number, number];
                      markerRef.current.setLatLng(newLatLng);
                      circleRef.current.setLatLng(newLatLng);
                      mapRef.current.setView(newLatLng, mapRef.current.getZoom());
                    }
                    if (typeof location.latitude === "number") {
                      void resolveAddress(location.latitude, lng);
                    }
                    setCoordinateError(null);
                  }
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600">
                ที่อยู่จากแผนที่ (แก้ไขได้)
              </label>
              <textarea
                value={location.address ?? ""}
                onChange={(e) => {
                  const { value } = e.target;
                  setLocation((prev) => ({
                    ...prev,
                    address: value,
                  }));

                  if (addressGeocodeTimerRef.current) {
                    window.clearTimeout(addressGeocodeTimerRef.current);
                  }

                  if (value.trim().length >= 3) {
                    addressGeocodeTimerRef.current = window.setTimeout(() => {
                      addressGeocodeTimerRef.current = null;
                      void geocodeAddress(value);
                    }, 800);
                  }
                }}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="ระบบจะเติมให้หลังจากเลือกตำแหน่ง"
              />
              {isResolvingAddress ? (
                <p className="mt-1 text-xs text-blue-500">กำลังค้นหาที่อยู่จากแผนที่...</p>
              ) : location.address ? (
                <p className="mt-1 text-xs text-slate-500">ตรวจสอบและแก้ไขข้อความนี้ได้ตามต้องการ</p>
              ) : null}
            </div>
          </div>

          {/* Radius slider */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <label className="block text-xs font-semibold text-slate-600">
              รัศมีการเช็กอิน (Geofence): {location.radius} เมตร
            </label>
            <input
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              step="10"
              value={location.radius}
              onChange={(e) => {
                const radius = parseInt(e.target.value, 10);
                setLocation((prev) => ({ ...prev, radius }));
              }}
              className="mt-2 w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>{MIN_RADIUS}m</span>
              <span>{MAX_RADIUS}m</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 p-5 flex-shrink-0">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            ลบตำแหน่ง
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              บันทึกตำแหน่ง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
