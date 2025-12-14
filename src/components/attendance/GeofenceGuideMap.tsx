"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons
const storeIcon = L.divIcon({
  className: 'custom-store-marker',
  html: '<div style="width: 32px; height: 32px; background: #16a34a; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const userIcon = L.divIcon({
  className: 'custom-user-marker',
  html: '<div style="width: 16px; height: 16px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3), 0 2px 6px rgba(0,0,0,0.3);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

type StoreCoords = {
  latitude: number;
  longitude: number;
};

type UserPosition = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp: number;
};

type GeofenceGuideMapProps = {
  storeCoords: StoreCoords;
  storeName: string;
  storeAddress?: string | null;
  storeRadius: number;
  userPosition: UserPosition | null;
};

// Component to auto-fit bounds when user position changes
function AutoFitBounds({ storeCoords, userPosition }: { storeCoords: StoreCoords; userPosition: UserPosition | null }) {
  const map = useMap();

  useEffect(() => {
    if (userPosition) {
      const bounds = L.latLngBounds(
        [storeCoords.latitude, storeCoords.longitude],
        [userPosition.latitude, userPosition.longitude]
      );
      map.fitBounds(bounds.pad(0.25));
    } else {
      map.setView([storeCoords.latitude, storeCoords.longitude], 17);
    }
  }, [storeCoords, userPosition, map]);

  return null;
}

export default function GeofenceGuideMap({
  storeCoords,
  storeName,
  storeAddress,
  storeRadius,
  userPosition,
}: GeofenceGuideMapProps) {
  console.log('[GeofenceGuideMap] Rendering with:', { storeCoords, userPosition });

  return (
    <div className="h-[320px] w-full overflow-hidden rounded-3xl border border-slate-200 shadow-inner bg-slate-50 relative">
      <MapContainer
        center={[storeCoords.latitude, storeCoords.longitude]}
        zoom={17}
        scrollWheelZoom={true}
        zoomControl={false}
        style={{ height: "100%", width: "100%", zIndex: 1 }}
        className="z-[1]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Auto-fit bounds component */}
        <AutoFitBounds storeCoords={storeCoords} userPosition={userPosition} />

        {/* Store marker */}
        <Marker
          position={[storeCoords.latitude, storeCoords.longitude]}
          icon={storeIcon}
        >
          <Popup>
            <div style={{ textAlign: "center", padding: "4px" }}>
              <strong style={{ color: "#16a34a" }}>📍 {storeName}</strong>
              {storeAddress && (
                <>
                  <br />
                  <span style={{ fontSize: "11px", color: "#64748b" }}>{storeAddress}</span>
                </>
              )}
            </div>
          </Popup>
        </Marker>

        {/* Store geofence circle */}
        <Circle
          center={[storeCoords.latitude, storeCoords.longitude]}
          radius={storeRadius}
          pathOptions={{
            color: "#16a34a",
            fillColor: "#22c55e",
            fillOpacity: 0.15,
            weight: 2,
          }}
        />

        {/* User position marker and accuracy circle */}
        {userPosition && (
          <>
            <Marker
              position={[userPosition.latitude, userPosition.longitude]}
              icon={userIcon}
            >
              <Popup>
                <div style={{ textAlign: "center", padding: "4px" }}>
                  <strong style={{ color: "#3b82f6" }}>📍 ตำแหน่งของคุณ</strong>
                  <br />
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {new Date(userPosition.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </Popup>
            </Marker>

            {/* User accuracy circle */}
            {userPosition.accuracy && Number.isFinite(userPosition.accuracy) && (
              <Circle
                center={[userPosition.latitude, userPosition.longitude]}
                radius={userPosition.accuracy}
                pathOptions={{
                  color: "#3b82f6",
                  fillColor: "#60a5fa",
                  fillOpacity: 0.1,
                  weight: 1,
                }}
              />
            )}

            {/* Connecting line */}
            <Polyline
              positions={[
                [userPosition.latitude, userPosition.longitude],
                [storeCoords.latitude, storeCoords.longitude],
              ]}
              pathOptions={{
                color: "#1d4ed8",
                weight: 3,
                dashArray: "6 6",
                opacity: 0.8,
              }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
