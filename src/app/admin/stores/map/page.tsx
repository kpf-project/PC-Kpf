"use client";

/**
 * Stores Map Page
 * Displays all stores on an interactive map with geofence visualization
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { StoreRecord } from "@/lib/supabaseDirectory";
import { RefreshCw } from "lucide-react";

// Dynamic import for map component (only loads on client-side)
const StoresMapClient = dynamic(() => import("./StoresMapClient"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
      <div className="text-center">
        <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-3 text-sm text-slate-600">กำลังโหลดแผนที่...</p>
      </div>
    </div>
  ),
});

type StoreWithLocation = StoreRecord & {
  latitude: number;
  longitude: number;
};

export default function StoresMapPage() {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreRecord | null>(null);

  // Fetch stores
  useEffect(() => {
    const fetchStores = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/stores");
        if (!response.ok) {
          throw new Error("ไม่สามารถโหลดรายชื่อร้าน/หน่วยงานได้");
        }
        const data = (await response.json()) as { stores?: StoreRecord[] };
        setStores(Array.isArray(data.stores) ? data.stores : []);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "ไม่สามารถโหลดรายชื่อร้าน/หน่วยงานได้";
        setError(message);
        setStores([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchStores();
  }, []);

  const storesWithLocation = stores.filter(
    (store): store is StoreWithLocation =>
      store.latitude !== null &&
      store.longitude !== null &&
      Number.isFinite(store.latitude) &&
      Number.isFinite(store.longitude),
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">แผนที่ร้านค้าทั้งหมด</h1>
          <p className="mt-1 text-sm text-slate-500">
            แสดงตำแหน่งและรัศมีการเช็กอินของร้านค้าแต่ละแห่ง
          </p>
        </div>
        <Link
          href="/admin/stores"
          className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
        >
          กลับไปหน้าจัดการ
        </Link>
      </header>

      {error && (
        <div className="rounded-3xl border border-red-100 bg-red-50/90 px-5 py-3 text-sm text-red-600 shadow-inner">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-96 items-center justify-center rounded-3xl border border-blue-100 bg-white/85">
          <div className="text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-500" />
            <p className="mt-3 text-sm text-slate-500">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      ) : storesWithLocation.length === 0 ? (
        <div className="flex h-96 flex-col items-center justify-center rounded-3xl border border-blue-100 bg-white/85">
          <p className="text-sm text-slate-500">ยังไม่มีร้านค้าที่มีตำแหน่งบนแผนที่</p>
          <Link
            href="/admin/stores"
            className="mt-4 text-sm font-semibold text-blue-600 hover:underline"
          >
            เพิ่มตำแหน่งร้านค้า
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-blue-100 bg-white p-4 shadow-inner shadow-blue-100/50">
              <StoresMapClient
                stores={stores}
                selectedStoreId={selectedStore?.id}
                onStoreSelect={setSelectedStore}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-inner shadow-emerald-100/50">
              <h2 className="text-sm font-semibold text-slate-800">
                สถิติ ({storesWithLocation.length} ร้าน)
              </h2>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>ร้านทั้งหมด:</span>
                  <span className="font-semibold">{stores.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>มีตำแหน่ง:</span>
                  <span className="font-semibold">{storesWithLocation.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>ไม่มีตำแหน่ง:</span>
                  <span className="font-semibold">{stores.length - storesWithLocation.length}</span>
                </div>
              </div>
            </div>

            {selectedStore && (
              <div className="rounded-3xl border border-blue-100 bg-white p-4 shadow-inner shadow-blue-100/50">
                <h2 className="text-sm font-semibold text-slate-800">ข้อมูลร้านที่เลือก</h2>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-800">{selectedStore.name}</p>
                  </div>
                  {selectedStore.province && (
                    <div>
                      <span className="text-xs text-slate-500">จังหวัด: </span>
                      <span>{selectedStore.province}</span>
                    </div>
                  )}
                  {selectedStore.address && (
                    <div>
                      <span className="text-xs text-slate-500">ที่อยู่: </span>
                      <span>{selectedStore.address}</span>
                    </div>
                  )}
                  {selectedStore.latitude && selectedStore.longitude && (
                    <div>
                      <span className="text-xs text-slate-500">พิกัด: </span>
                      <span>
                        {selectedStore.latitude.toFixed(6)}, {selectedStore.longitude.toFixed(6)}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-slate-500">รัศมีเช็กอิน: </span>
                    <span>{selectedStore.radius ?? 100}m</span>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-inner shadow-slate-100/50">
              <h2 className="text-sm font-semibold text-slate-800">รายชื่อร้าน</h2>
              <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
                {storesWithLocation.map((store) => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => setSelectedStore(store)}
                    className={`w-full rounded-xl border p-3 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50 ${
                      selectedStore?.id === store.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="font-semibold text-slate-800">{store.name}</p>
                    {store.province && (
                      <p className="mt-1 text-xs text-slate-500">{store.province}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
