"use client";

/**
 * Thailand Store Map with Professional Pulse Markers
 * Interactive map showing store performance across Thailand
 */

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { MapPin, TrendingUp, ShoppingBag } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface StoreMarker {
  id: string;
  name: string;
  province: string;
  lat: number;
  lng: number;
  sales: number;
  transactions: number;
}

interface ThailandStoreMapProps {
  stores: StoreMarker[];
  selectedStoreId?: string | null;
  onStoreSelect?: (storeId: string) => void;
}

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("th-TH");

// Get performance level based on sales
function getPerformanceLevel(sales: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (sales > 500000) return 'excellent';
  if (sales > 200000) return 'good';
  if (sales > 100000) return 'fair';
  return 'poor';
}

// Create Professional Pulse Marker Icon
function createPulseMarkerIcon(store: StoreMarker): L.DivIcon {
  const level = getPerformanceLevel(store.sales);
  const salesFormatted = currencyFormatter.format(store.sales);

  return L.divIcon({
    html: `
      <div class="pulse-marker-container">
        <div class="pulse-rings pulse-rings-${level}">
          <div class="pulse-ring"></div>
        </div>
        <div class="marker-pin marker-pin-${level}"></div>
        <div class="marker-badge" style="border-color: ${
          level === 'excellent' ? '#10b981' :
          level === 'good' ? '#3b82f6' :
          level === 'fair' ? '#f59e0b' : '#ef4444'
        }">
          <div class="marker-badge-content">
            <span class="marker-store-name">${store.name}</span>
            <span class="marker-store-sales">${salesFormatted}</span>
          </div>
        </div>
      </div>
    `,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

// Component to handle map view updates
function MapViewController({ selectedStoreId, stores }: { selectedStoreId?: string | null; stores: StoreMarker[] }) {
  const map = useMap();
  const prevStoreIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  // Fly to selected store
  useEffect(() => {
    if (!selectedStoreId || selectedStoreId === prevStoreIdRef.current) return;

    const store = stores.find(s => s.id === selectedStoreId);
    if (store && store.lat && store.lng) {
      map.flyTo([store.lat, store.lng], 14, {
        animate: true,
        duration: 1.5,
      });
      prevStoreIdRef.current = selectedStoreId;
    }
  }, [selectedStoreId, stores, map]);

  // Fit bounds on initial load only
  useEffect(() => {
    if (!isInitialLoadRef.current || stores.length === 0) return;

    const bounds = stores.map(store => [store.lat, store.lng] as [number, number]);
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], animate: false });
      isInitialLoadRef.current = false;
    }
  }, [stores, map]);

  return null;
}

export default function ThailandStoreMap({ stores, selectedStoreId, onStoreSelect }: ThailandStoreMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <MapSkeleton />;
  }

  // Thailand center coordinates (Bangkok)
  const thailandCenter: [number, number] = [13.7563, 100.5018];

  // Calculate total sales
  const totalSales = stores.reduce((sum, store) => sum + store.sales, 0);
  const avgSalesPerStore = stores.length > 0 ? totalSales / stores.length : 0;
  const topStore = stores.reduce((max, store) => (store.sales > max.sales ? store : max), stores[0] || { sales: 0 });

  return (
    <div className="rounded-3xl border-2 border-blue-100 bg-white p-4 sm:p-6 shadow-xl">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">Store Performance Map</h3>
          <p className="text-xs sm:text-sm text-slate-500">ยอดขายตามสถานที่ทั่วประเทศไทย</p>
        </div>
        <div className="rounded-full border border-blue-200 bg-blue-50 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-blue-600 w-fit">
          {stores.length} ร้าน
        </div>
      </div>

      {/* Map Container */}
      <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] overflow-hidden rounded-2xl border-2 border-blue-100">
        <MapContainer
          center={thailandCenter}
          zoom={6}
          style={{ height: "100%", width: "100%", zIndex: 1 }}
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          <MapViewController selectedStoreId={selectedStoreId} stores={stores} />

          {/* Store Markers with Pulse Animation */}
          {stores.map((store) => {
            const icon = createPulseMarkerIcon(store);

            return (
              <Marker
                key={store.id}
                position={[store.lat, store.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    if (onStoreSelect) {
                      onStoreSelect(store.id);
                    }
                  },
                }}
              >
                <Popup>
                  <div className="p-3 min-w-[220px]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="rounded-lg bg-gradient-to-br from-blue-500 to-sky-400 p-2">
                        <MapPin className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">{store.name}</h4>
                        <p className="text-xs text-slate-500">{store.province}</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          ยอดขาย:
                        </span>
                        <span className="text-sm font-bold text-blue-600">
                          {currencyFormatter.format(store.sales)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <ShoppingBag className="h-3 w-3" />
                          ธุรกรรม:
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {numberFormatter.format(store.transactions)} รายการ
                        </span>
                      </div>

                      {store.transactions > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600">Avg/ธุรกรรม:</span>
                          <span className="text-sm font-semibold text-slate-900">
                            {currencyFormatter.format(Math.round(store.sales / store.transactions))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 border-2 border-white shadow" />
          <span className="text-xs font-medium text-slate-700">&gt; ฿500K (ดีเยี่ยม)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white shadow" />
          <span className="text-xs font-medium text-slate-700">฿200K - ฿500K (ดี)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 border-2 border-white shadow" />
          <span className="text-xs font-medium text-slate-700">฿100K - ฿200K (พอใช้)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-gradient-to-br from-red-500 to-red-600 border-2 border-white shadow" />
          <span className="text-xs font-medium text-slate-700">&lt; ฿100K (ต้องเร่ง)</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50 p-3 text-center">
          <p className="text-xs text-slate-600 mb-1">ยอดขายรวม</p>
          <p className="text-sm sm:text-base lg:text-lg font-bold text-blue-600 truncate px-1">
            {currencyFormatter.format(totalSales)}
          </p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50 p-3 text-center">
          <p className="text-xs text-slate-600 mb-1">เฉลี่ยต่อร้าน</p>
          <p className="text-sm sm:text-base lg:text-lg font-bold text-blue-600 truncate px-1">
            {currencyFormatter.format(Math.round(avgSalesPerStore))}
          </p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50 p-3 text-center">
          <p className="text-xs text-slate-600 mb-1">ร้านสูงสุด</p>
          <p className="text-sm sm:text-base lg:text-lg font-bold text-blue-600 truncate px-1">
            {currencyFormatter.format(topStore?.sales || 0)}
          </p>
        </div>
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="rounded-3xl border-2 border-blue-100 bg-white p-4 sm:p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-8 w-32 animate-pulse rounded-full bg-slate-200" />
      </div>
      <div className="h-[500px] animate-pulse rounded-2xl bg-slate-200" />
      <div className="mt-4 flex justify-center gap-6">
        <div className="h-6 w-24 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-6 w-24 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-6 w-24 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-6 w-24 animate-pulse rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}
