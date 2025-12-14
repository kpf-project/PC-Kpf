"use client";

import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import {
  MapPin, Search, Plus, X, Trash2, Edit2,
  Filter, Sparkles, Building2, Map as MapIcon, Navigation, ExternalLink
} from "lucide-react";
import type { StoreRecord } from "@/lib/supabaseDirectory";
import { THAI_PROVINCES } from "@/lib/thaiGeography";
import type { LocationData } from "@/components/admin/StoreLocationPicker";
import { useModal } from "@/contexts/ModalContext";

// Dynamically import the map picker to avoid SSR issues
const StoreLocationPicker = lazy(() => import("@/components/admin/StoreLocationPicker"));

type DraftStore = Pick<
  StoreRecord,
  "id" | "name" | "province" | "address" | "latitude" | "longitude" | "radius" | "createdAt" | "updatedAt"
>;

type StoreFormState = {
  name: string;
  province: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  radius: number | null;
};

const EMPTY_FORM: StoreFormState = {
  name: "",
  province: "",
  address: "",
  latitude: null,
  longitude: null,
  radius: null,
};

export default function StoresPagePremium() {
  const { openModal, closeModal } = useModal();
  const [stores, setStores] = useState<DraftStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // UI States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProvince, setFilterProvince] = useState("");
  const [editingStore, setEditingStore] = useState<DraftStore | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPickerMode, setMapPickerMode] = useState<"add" | "edit">("add");

  // Form States
  const [addForm, setAddForm] = useState<StoreFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<StoreFormState>(EMPTY_FORM);

  // Load data
  useEffect(() => {
    void loadStores();
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Sync Add Modal with ModalContext
  useEffect(() => {
    const MODAL_ID = 'store-add-modal';
    if (isAddModalOpen) {
      openModal(MODAL_ID);
    } else {
      closeModal(MODAL_ID);
    }

    return () => {
      closeModal(MODAL_ID);
    };
  }, [isAddModalOpen, openModal, closeModal]);

  // Sync Edit Modal with ModalContext
  useEffect(() => {
    const MODAL_ID = 'store-edit-modal';
    if (isEditModalOpen) {
      openModal(MODAL_ID);
    } else {
      closeModal(MODAL_ID);
    }

    return () => {
      closeModal(MODAL_ID);
    };
  }, [isEditModalOpen, openModal, closeModal]);

  // Sync Map Picker with ModalContext
  useEffect(() => {
    const MODAL_ID = 'store-map-picker';
    if (showMapPicker) {
      openModal(MODAL_ID);
    } else {
      closeModal(MODAL_ID);
    }

    return () => {
      closeModal(MODAL_ID);
    };
  }, [showMapPicker, openModal, closeModal]);

  const loadStores = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/stores");
      if (!response.ok) throw new Error("ไม่สามารถโหลดข้อมูลได้");
      const data = await response.json();
      setStores(Array.isArray(data.stores) ? data.stores : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) {
      setError("กรุณาระบุชื่อร้าน");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          province: addForm.province || undefined,
          address: addForm.address.trim() || undefined,
          latitude: addForm.latitude,
          longitude: addForm.longitude,
          radius: addForm.radius,
        }),
      });

      if (!response.ok) throw new Error("ไม่สามารถเพิ่มร้านได้");

      setAddForm(EMPTY_FORM);
      setIsAddModalOpen(false);
      setSuccessMessage("✨ เพิ่มร้านค้าสำเร็จ");
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.name.trim()) {
      setError("กรุณาระบุชื่อร้าน");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/stores/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          province: editForm.province || undefined,
          address: editForm.address.trim() || undefined,
          latitude: editForm.latitude,
          longitude: editForm.longitude,
          radius: editForm.radius,
        }),
      });

      if (!response.ok) throw new Error("ไม่สามารถอัปเดตได้");

      setEditingStore(null);
      setIsEditModalOpen(false);
      setSuccessMessage("✨ อัปเดตร้านค้าสำเร็จ");
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`ต้องการลบร้าน "${name}" หรือไม่?`)) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/stores/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("ไม่สามารถลบร้านได้");

      setSuccessMessage("✨ ลบร้านค้าสำเร็จ");
      await loadStores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenMapPicker = (mode: "add" | "edit") => {
    setMapPickerMode(mode);
    setShowMapPicker(true);
  };

  const handleLocationChange = (location: LocationData | null) => {
    const formSetter = mapPickerMode === "add" ? setAddForm : setEditForm;
    formSetter(prev => ({
      ...prev,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      radius: location?.radius ?? null,
      address: location?.address ?? prev.address,
    }));
  };

  // Filtered stores
  const filteredStores = useMemo(() => {
    return stores.filter(store => {
      const matchSearch = !searchQuery ||
        store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (store.address && store.address.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchProvince = !filterProvince || store.province === filterProvince;

      return matchSearch && matchProvince;
    });
  }, [stores, searchQuery, filterProvince]);

  const sortedStores = useMemo(() => {
    return [...filteredStores].sort((a, b) =>
      a.name.localeCompare(b.name, "th-TH")
    );
  }, [filteredStores]);

  const currentLocationData = (() => {
    const form = mapPickerMode === "add" ? addForm : editForm;
    if (form.latitude && form.longitude) {
      return {
        latitude: form.latitude,
        longitude: form.longitude,
        radius: form.radius ?? 100,
        address: form.address,
      };
    }
    return null;
  })();

  // Stats
  const storesWithGPS = stores.filter(s => s.latitude && s.longitude).length;
  const uniqueProvinces = new Set(stores.map(s => s.province).filter(Boolean)).size;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-sky-50/20">
      {/* ✨ Premium Header with Gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 px-4 sm:px-6 lg:px-8 py-8 sm:py-12 shadow-xl">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-2xl bg-white/20 backdrop-blur-sm p-3 border border-white/30">
              <Building2 className="h-8 w-8 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">
                จัดการร้านค้า
              </h1>
              <p className="text-sm text-blue-50 mt-1">
                ระบบจัดการข้อมูลร้านค้าแบบ Enterprise
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3">
              <p className="text-xs text-blue-100">ร้านทั้งหมด</p>
              <p className="text-2xl font-bold text-white">{stores.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3">
              <p className="text-xs text-blue-100">พบในระบบ</p>
              <p className="text-2xl font-bold text-white">{filteredStores.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3">
              <p className="text-xs text-blue-100">จังหวัด</p>
              <p className="text-2xl font-bold text-white">{uniqueProvinces}</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3">
              <p className="text-xs text-blue-100">มีพิกัด GPS</p>
              <p className="text-2xl font-bold text-white">{storesWithGPS}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Messages */}
        {error && (
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-lg animate-slide-in">
            <p className="font-semibold">เกิดข้อผิดพลาด</p>
            <p>{error}</p>
          </div>
        )}
        {successMessage && (
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-700 shadow-lg animate-slide-in">
            {successMessage}
          </div>
        )}

        {/* 🔍 Glassmorphism Search Bar */}
        <div className="rounded-3xl bg-white/80 backdrop-blur-xl border-2 border-white/60 shadow-2xl shadow-blue-500/10 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อร้าน, ที่อยู่..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-blue-100 bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all text-sm"
              />
            </div>

            {/* Province Filter */}
            <div className="relative sm:w-48">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              <select
                value={filterProvince}
                onChange={(e) => setFilterProvince(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-blue-100 bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all text-sm appearance-none cursor-pointer"
              >
                <option value="">ทุกจังหวัด</option>
                {THAI_PROVINCES.map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Add Button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 transition-all"
            >
              <Plus className="h-5 w-5" />
              <span className="hidden sm:inline">เพิ่มร้านค้า</span>
              <span className="sm:hidden">เพิ่ม</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="rounded-3xl bg-white/80 backdrop-blur-xl border-2 border-blue-100 shadow-xl p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
            <p className="mt-4 text-sm text-slate-500">กำลังโหลดข้อมูล...</p>
          </div>
        ) : sortedStores.length === 0 ? (
          <div className="rounded-3xl bg-white/80 backdrop-blur-xl border-2 border-dashed border-blue-200 shadow-xl p-12 text-center">
            <Sparkles className="h-12 w-12 text-blue-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">
              {searchQuery || filterProvince ? "ไม่พบข้อมูลที่ค้นหา" : "ยังไม่มีร้านค้าในระบบ"}
            </p>
            <p className="text-sm text-slate-400 mt-2">
              คลิกปุ่ม &ldquo;เพิ่มร้านค้า&rdquo; เพื่อเริ่มต้น
            </p>
          </div>
        ) : (
          <>
            {/* 📊 Desktop Table View */}
            <div className="hidden md:block rounded-3xl bg-white/80 backdrop-blur-xl border-2 border-white/60 shadow-2xl shadow-blue-500/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-50 to-sky-50 border-b-2 border-blue-100">
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        ร้านค้า
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        จังหวัด
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        ที่อยู่
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        พิกัด
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                        จัดการ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedStores.map((store, index) => (
                      <tr
                        key={store.id}
                        className="group hover:bg-blue-50/50 transition-all"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center shadow-lg">
                              <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{store.name}</p>
                              <p className="text-xs text-slate-500">
                                สร้าง: {new Date(store.createdAt).toLocaleDateString("th-TH")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {store.province ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-xs font-medium text-blue-700">
                              <MapPin className="h-3 w-3" />
                              {store.province}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          {store.address ? (
                            <p className="text-sm text-slate-600 truncate">{store.address}</p>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {store.latitude && store.longitude ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                                <Navigation className="h-3 w-3 text-emerald-600" />
                                {store.latitude.toFixed(4)}, {store.longitude.toFixed(4)}
                              </span>
                              <span className="text-xs text-slate-500">
                                รัศมี: {store.radius || 100}m
                              </span>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${store.latitude},${store.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Google Maps
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">ไม่มีพิกัด</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingStore(store);
                                setEditForm({
                                  name: store.name,
                                  province: store.province || "",
                                  address: store.address || "",
                                  latitude: store.latitude ?? null,
                                  longitude: store.longitude ?? null,
                                  radius: store.radius ?? null,
                                });
                                setIsEditModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              แก้ไข
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(store.id, store.name);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              ลบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 📱 Mobile Card View */}
            <div className="md:hidden space-y-3">
              {sortedStores.map((store) => (
                <div
                  key={store.id}
                  className="rounded-2xl bg-white/80 backdrop-blur-xl border-2 border-white/60 shadow-lg p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center shadow-lg">
                      <Building2 className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{store.name}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(store.createdAt).toLocaleDateString("th-TH")}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {store.province && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-xs text-blue-700">
                        <MapPin className="h-3 w-3" />
                        {store.province}
                      </span>
                    )}
                    {store.latitude && store.longitude && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-xs text-emerald-700">
                        <Navigation className="h-3 w-3" />
                        มีพิกัด
                      </span>
                    )}
                  </div>

                  {store.address && (
                    <p className="text-xs text-slate-600 mb-3 line-clamp-2">{store.address}</p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setEditingStore(store);
                        setEditForm({
                          name: store.name,
                          province: store.province || "",
                          address: store.address || "",
                          latitude: store.latitude ?? null,
                          longitude: store.longitude ?? null,
                          radius: store.radius ?? null,
                        });
                        setIsEditModalOpen(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(store.id, store.name)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-200 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      ลบ
                    </button>
                  </div>

                  {/* Google Maps Link */}
                  {store.latitude && store.longitude && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${store.latitude},${store.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      เปิดใน Google Maps
                    </a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ➕ Add Store Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 px-6 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/20 backdrop-blur-sm p-2 border border-white/30">
                    <Plus className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">เพิ่มร้านค้าใหม่</h2>
                    <p className="text-sm text-blue-100 mt-1">กรอกข้อมูลร้านค้า</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg p-2 hover:bg-white/20 transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    ชื่อร้านค้า *
                  </label>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                    className="form-input w-full"
                    placeholder="เช่น ร้าน A สาขาเชียงใหม่"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    จังหวัด
                  </label>
                  <select
                    value={addForm.province}
                    onChange={(e) => setAddForm(prev => ({ ...prev, province: e.target.value }))}
                    className="form-input w-full"
                  >
                    <option value="">เลือกจังหวัด</option>
                    {THAI_PROVINCES.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    ที่อยู่
                  </label>
                  <input
                    type="text"
                    value={addForm.address}
                    onChange={(e) => setAddForm(prev => ({ ...prev, address: e.target.value }))}
                    className="form-input w-full"
                    placeholder="ที่อยู่เต็ม"
                  />
                </div>
              </div>

              {/* Map Location Picker */}
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-600 mb-3">
                  ตำแหน่งบนแผนที่ (สำหรับ Geofencing)
                </label>
                {addForm.latitude && addForm.longitude ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <MapIcon className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm font-semibold text-emerald-900">มีพิกัดแล้ว</span>
                        </div>
                        <p className="text-xs text-emerald-700">
                          {addForm.latitude.toFixed(6)}, {addForm.longitude.toFixed(6)}
                        </p>
                        <p className="text-xs text-emerald-700 mt-1">
                          รัศมี: {addForm.radius || 100} เมตร
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenMapPicker("add")}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                      >
                        แก้ไข
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenMapPicker("add")}
                    className="w-full rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 px-4 py-6 text-center hover:bg-blue-100 transition-colors"
                  >
                    <MapIcon className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-blue-700">เลือกตำแหน่งบนแผนที่</p>
                    <p className="text-xs text-blue-600 mt-1">คลิกเพื่อเปิดแผนที่และปักหมุด</p>
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 p-6 bg-slate-50">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setAddForm(EMPTY_FORM);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleAdd}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 text-sm font-bold text-white shadow-lg hover:shadow-xl disabled:opacity-50 transition-all"
                >
                  {isSaving ? "กำลังบันทึก..." : "✨ เพิ่มร้านค้า"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ Edit Store Modal */}
      {isEditModalOpen && editingStore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => {
            setIsEditModalOpen(false);
            setEditingStore(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 px-6 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/20 backdrop-blur-sm p-2 border border-white/30">
                    <Edit2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">แก้ไขข้อมูลร้านค้า</h2>
                    <p className="text-sm text-blue-100 mt-1">{editingStore.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingStore(null);
                  }}
                  className="rounded-lg p-2 hover:bg-white/20 transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    ชื่อร้านค้า *
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="form-input w-full"
                    placeholder="ชื่อร้านค้า"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    จังหวัด
                  </label>
                  <select
                    value={editForm.province}
                    onChange={(e) => setEditForm(prev => ({ ...prev, province: e.target.value }))}
                    className="form-input w-full"
                  >
                    <option value="">เลือกจังหวัด</option>
                    {THAI_PROVINCES.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    ที่อยู่
                  </label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                    className="form-input w-full"
                    placeholder="ที่อยู่เต็ม"
                  />
                </div>
              </div>

              {/* Map Location Picker */}
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-600 mb-3">
                  ตำแหน่งบนแผนที่ (สำหรับ Geofencing)
                </label>
                {editForm.latitude && editForm.longitude ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <MapIcon className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm font-semibold text-emerald-900">มีพิกัดแล้ว</span>
                        </div>
                        <p className="text-xs text-emerald-700">
                          {editForm.latitude.toFixed(6)}, {editForm.longitude.toFixed(6)}
                        </p>
                        <p className="text-xs text-emerald-700 mt-1">
                          รัศมี: {editForm.radius || 100} เมตร
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenMapPicker("edit")}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                      >
                        แก้ไข
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenMapPicker("edit")}
                    className="w-full rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 px-4 py-6 text-center hover:bg-blue-100 transition-colors"
                  >
                    <MapIcon className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-blue-700">เลือกตำแหน่งบนแผนที่</p>
                    <p className="text-xs text-blue-600 mt-1">คลิกเพื่อเปิดแผนที่และปักหมุด</p>
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 p-6 bg-slate-50">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setAddForm(EMPTY_FORM);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleAdd}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 text-sm font-bold text-white shadow-lg hover:shadow-xl disabled:opacity-50 transition-all"
                >
                  {isSaving ? "กำลังบันทึก..." : "✨ เพิ่มร้านค้า"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ Edit Store Modal */}
      {isEditModalOpen && editingStore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => {
            setIsEditModalOpen(false);
            setEditingStore(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 px-6 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/20 backdrop-blur-sm p-2 border border-white/30">
                    <Edit2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">แก้ไขข้อมูลร้านค้า</h2>
                    <p className="text-sm text-blue-100 mt-1">{editingStore.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingStore(null);
                  }}
                  className="rounded-lg p-2 hover:bg-white/20 transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    ชื่อร้านค้า *
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="form-input w-full"
                    placeholder="ชื่อร้านค้า"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    จังหวัด
                  </label>
                  <select
                    value={editForm.province}
                    onChange={(e) => setEditForm(prev => ({ ...prev, province: e.target.value }))}
                    className="form-input w-full"
                  >
                    <option value="">เลือกจังหวัด</option>
                    {THAI_PROVINCES.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    ที่อยู่
                  </label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                    className="form-input w-full"
                    placeholder="ที่อยู่เต็ม"
                  />
                </div>
              </div>

              {/* Map Location Picker */}
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-600 mb-3">
                  ตำแหน่งบนแผนที่ (สำหรับ Geofencing)
                </label>
                {editForm.latitude && editForm.longitude ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <MapIcon className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm font-semibold text-emerald-900">มีพิกัดแล้ว</span>
                        </div>
                        <p className="text-xs text-emerald-700">
                          {editForm.latitude.toFixed(6)}, {editForm.longitude.toFixed(6)}
                        </p>
                        <p className="text-xs text-emerald-700 mt-1">
                          รัศมี: {editForm.radius || 100} เมตร
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenMapPicker("edit")}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                      >
                        แก้ไข
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenMapPicker("edit")}
                    className="w-full rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 px-4 py-6 text-center hover:bg-blue-100 transition-colors"
                  >
                    <MapIcon className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-blue-700">เลือกตำแหน่งบนแผนที่</p>
                    <p className="text-xs text-blue-600 mt-1">คลิกเพื่อเปิดแผนที่และปักหมุด</p>
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 p-6 bg-slate-50">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingStore(null);
                    setEditForm(EMPTY_FORM);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => handleUpdate(editingStore.id)}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 text-sm font-bold text-white shadow-lg hover:shadow-xl disabled:opacity-50 transition-all"
                >
                  {isSaving ? "กำลังบันทึก..." : "💾 บันทึกการแก้ไข"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🗺️ Map Picker Modal */}
      {showMapPicker && (
        <Suspense fallback={<div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
          <div className="text-white">Loading map...</div>
        </div>}>
          <StoreLocationPicker
            initialLocation={currentLocationData}
            onLocationChange={handleLocationChange}
            onClose={() => setShowMapPicker(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
