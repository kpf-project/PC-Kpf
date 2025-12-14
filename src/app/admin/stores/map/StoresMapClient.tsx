"use client";

/**
 * StoresMapClient Component
 * Displays all stores on an interactive map using react-leaflet
 */

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from "react-leaflet";
import type { StoreRecord } from "@/lib/supabaseDirectory";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default marker icon
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type StoreWithLocation = StoreRecord & {
  latitude: number;
  longitude: number;
};

interface StoresMapClientProps {
  stores: StoreRecord[];
  selectedStoreId?: string | null;
  onStoreSelect?: (store: StoreRecord) => void;
}

// Province colors mapping
const provinceColors: Record<string, string> = {
  กรุงเทพมหานคร: "#3b82f6", // blue
  เชียงใหม่: "#10b981", // green
  ภูเก็ต: "#f59e0b", // orange
  ขอนแก่น: "#8b5cf6", // purple
  สงขลา: "#ec4899", // pink
};

function getMarkerColor(province: string | null | undefined): string {
  if (!province) return "#6b7280"; // gray
  return provinceColors[province] || "#6b7280";
}

// Component to handle map view updates
function MapViewController({ selectedStoreId, stores }: { selectedStoreId?: string | null; stores: StoreWithLocation[] }) {
  const map = useMap();
  const prevStoreIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  // Fly to selected store
  useEffect(() => {
    if (!selectedStoreId || selectedStoreId === prevStoreIdRef.current) return;

    const store = stores.find(s => s.id === selectedStoreId);
    if (store && store.latitude && store.longitude) {
      // Use flyTo for smooth animated transition
      map.flyTo([store.latitude, store.longitude], 16, {
        animate: true,
        duration: 1.5, // 1.5 seconds animation
      });
      prevStoreIdRef.current = selectedStoreId;
    }
  }, [selectedStoreId, stores, map]);

  // Fit bounds on initial load only
  useEffect(() => {
    if (!isInitialLoadRef.current || stores.length === 0) return;

    const bounds = stores.map(store => [store.latitude, store.longitude] as [number, number]);
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], animate: false });
      isInitialLoadRef.current = false;
    }
  }, [stores, map]);

  return null;
}

export default function StoresMapClient({ stores, selectedStoreId, onStoreSelect }: StoresMapClientProps) {
  const storesWithLocation = stores.filter(
    (store): store is StoreWithLocation =>
      store.latitude !== null &&
      store.longitude !== null &&
      Number.isFinite(store.latitude) &&
      Number.isFinite(store.longitude),
  );

  if (storesWithLocation.length === 0) {
    return (
      <div className="flex h-[600px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
        <p className="text-sm text-slate-500">ยังไม่มีร้านค้าที่มีตำแหน่งบนแผนที่</p>
      </div>
    );
  }

  return (
    <div className="h-[600px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-lg">
      <MapContainer
        center={[13.7563, 100.5018]} // Bangkok center
        zoom={6}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", zIndex: 1 }}
        className="z-[1]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapViewController selectedStoreId={selectedStoreId} stores={storesWithLocation} />

        {storesWithLocation.map((store) => {
          const markerColor = getMarkerColor(store.province);
          const radius = store.radius ?? 100;

          return (
            <div key={store.id}>
              {/* Marker */}
              <Marker
                position={[store.latitude, store.longitude]}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    if (onStoreSelect) {
                      onStoreSelect(store);
                    }
                  },
                }}
              >
                <Popup>
                  <div style={{ minWidth: "200px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 8px 0", color: "#1e293b" }}>
                      {store.name}
                    </h3>
                    {store.province && (
                      <p style={{ fontSize: "12px", margin: "4px 0", color: "#64748b" }}>
                        <strong>จังหวัด:</strong> {store.province}
                      </p>
                    )}
                    {store.address && (
                      <p style={{ fontSize: "12px", margin: "4px 0", color: "#64748b" }}>
                        <strong>ที่อยู่:</strong> {store.address}
                      </p>
                    )}
                    <p style={{ fontSize: "12px", margin: "4px 0", color: "#64748b" }}>
                      <strong>พิกัด:</strong> {store.latitude.toFixed(6)}, {store.longitude.toFixed(6)}
                    </p>
                    <p style={{ fontSize: "12px", margin: "4px 0", color: "#64748b" }}>
                      <strong>รัศมีเช็กอิน:</strong> {radius}m
                    </p>
                  </div>
                </Popup>
              </Marker>

              {/* Geofence Circle */}
              <Circle
                center={[store.latitude, store.longitude]}
                radius={radius}
                pathOptions={{
                  color: markerColor,
                  fillColor: markerColor,
                  fillOpacity: 0.1,
                  weight: 2,
                }}
              />
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}
