/**
 * PC Report Form Client Component
 *
 * Main form for PC daily reports with:
 * - Employee and store selection
 * - Shelf photos upload
 * - Stock usage tracking
 * - Customer activities
 * - Competitor and store promotion monitoring
 * - Auto-save draft functionality
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import SiteNav from "@/components/SiteNav";
import ShelfPhotosSection, {
  type ShelfPhoto,
} from "./components/ShelfPhotosSection";
import StockUsageSection, {
  type Product,
  type StockUsageItem,
} from "./components/StockUsageSection";
import PromotionSection from "./components/PromotionSection";

type Employee = {
  id: string;
  name: string;
  employeeCode: string | null;
};

type Store = {
  id: string;
  name: string;
  province: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius: number | null;
};

type PCReportFormClientProps = {
  employees: Employee[];
  stores: Store[];
};

type FormState = {
  reportDate: string;
  employeeId: string;
  storeId: string;
  reportId?: string;

  shelfPhotos: ShelfPhoto[];
  stockItems: StockUsageItem[];
  customerActivities: string;
  competitorPromoPhotos: string[];
  competitorPromoNotes: string;
  storePromoPhotos: string[];
  storePromoNotes: string;

  status: "draft" | "submitted";
};

const todayString = () => {
  const now = new Date();
  return now.toISOString().split("T")[0]; // YYYY-MM-DD
};

export default function PCReportFormClient({
  employees,
  stores,
}: PCReportFormClientProps) {
  const [formState, setFormState] = useState<FormState>({
    reportDate: todayString(),
    employeeId: "",
    storeId: "",
    shelfPhotos: [],
    stockItems: [],
    customerActivities: "",
    competitorPromoPhotos: [],
    competitorPromoNotes: "",
    storePromoPhotos: [],
    storePromoNotes: "",
    status: "draft",
  });

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveDataRef = useRef<string>("");

  // Get employee stores assignments
  const employeeStoresQuery = useQuery({
    queryKey: ["employee-stores", formState.employeeId],
    queryFn: async () => {
      if (!formState.employeeId) return [];
      const res = await fetch(
        `/api/admin/employees/${formState.employeeId}/stores`
      );
      if (!res.ok) throw new Error("Failed to fetch employee stores");
      const data = await res.json();

      // Check if response has expected structure
      if (!data.success || !Array.isArray(data.assignments)) {
        console.error("Invalid employee stores response:", data);
        return [];
      }

      // Transform assignments to Store format
      return data.assignments.map((assignment: { storeId: string; storeName: string }) => ({
        id: assignment.storeId,
        name: assignment.storeName,
      })) as Store[];
    },
    enabled: !!formState.employeeId,
  });

  // Auto-select store if employee has only one
  useEffect(() => {
    if (
      employeeStoresQuery.data &&
      employeeStoresQuery.data.length === 1 &&
      !formState.storeId
    ) {
      setFormState((prev) => ({
        ...prev,
        storeId: employeeStoresQuery.data![0].id,
      }));
    }
  }, [employeeStoresQuery.data, formState.storeId]);

  // Load products when employee + store selected
  useEffect(() => {
    if (!formState.employeeId || !formState.storeId) {
      setProducts([]);
      return;
    }

    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        // Use assignments API to get products assigned to this employee + store
        const res = await fetch(
          `/api/admin/products/assignments?employeeId=${formState.employeeId}&storeId=${formState.storeId}&onlyActive=true`
        );
        if (!res.ok) throw new Error("Failed to fetch products");
        const data = await res.json();

        // Transform API response (ProductAssignment[]) to Product type
        const transformedProducts: Product[] = data.assignments.map(
          (assignment: {
            productId: string;
            productCode: string;
            productName: string;
            units: {
              unitId: string;
              unitName: string;
              multiplierToBase: number;
            }[];
          }) => ({
            id: assignment.productId,
            code: assignment.productCode,
            name: assignment.productName,
            units: assignment.units.map((u) => ({
              id: u.unitId,
              name: u.unitName,
              multiplierToBase: u.multiplierToBase,
            })),
          })
        );

        setProducts(transformedProducts);
      } catch (error) {
        console.error("Failed to load products:", error);
        alert("ไม่สามารถโหลดรายการสินค้าได้");
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProducts();
  }, [formState.employeeId, formState.storeId]);

  // Load existing report when date + employee + store changes
  useEffect(() => {
    if (!formState.reportDate || !formState.employeeId || !formState.storeId) {
      return;
    }

    const loadReport = async () => {
      try {
        const res = await fetch(
          `/api/admin/pc-reports?date=${formState.reportDate}&employee_id=${formState.employeeId}&store_id=${formState.storeId}&include_details=true`
        );

        if (!res.ok) {
          // No existing report, that's fine
          return;
        }

        const data = await res.json();
        if (!data.success || !data.reports || data.reports.length === 0) return;

        const report = data.reports[0]; // Get first report from array
        const reportId = report.id;

        // Get photos and stock usage for this specific report
        const shelfPhotos = data.photos?.[reportId] || [];
        const stockUsage = data.stock_usage?.[reportId] || [];

        // Transform shelf photos
        const transformedShelfPhotos: ShelfPhoto[] = shelfPhotos.map(
          (photo: {
            id: string;
            photo_url: string;
            storage_path: string;
            caption: string | null;
            uploaded_at: string;
          }) => ({
            id: photo.id,
            photoUrl: photo.photo_url,
            storagePath: photo.storage_path,
            caption: photo.caption || "",
            uploadedAt: photo.uploaded_at,
          })
        );

        // Transform stock usage
        const transformedStockUsage: StockUsageItem[] = stockUsage.map(
          (item: {
            id: string;
            product_id: string;
            product_code: string;
            product_name: string;
            quantities: Record<string, number>;
            total_base_units: number;
          }) => ({
            id: item.id,
            productId: item.product_id,
            productCode: item.product_code,
            productName: item.product_name,
            quantities: item.quantities,
            totalBaseUnits: item.total_base_units,
          })
        );

        setFormState((prev) => ({
          ...prev,
          reportId: report.id,
          shelfPhotos: transformedShelfPhotos,
          stockItems: transformedStockUsage,
          customerActivities: report.customer_activities || "",
          competitorPromoPhotos: report.competitor_promo_photos || [],
          competitorPromoNotes: report.competitor_promo_notes || "",
          storePromoPhotos: report.store_promo_photos || [],
          storePromoNotes: report.store_promo_notes || "",
          status: report.status,
        }));
      } catch (error) {
        console.error("Failed to load existing report:", error);
      }
    };

    loadReport();
  }, [formState.reportDate, formState.employeeId, formState.storeId]);

  // Upload photo helper
  const uploadPhoto = useCallback(
    async (
      file: File,
      photoType: "shelf" | "competitor" | "store-promo"
    ): Promise<{ photoUrl: string; storagePath: string }> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("employee_id", formState.employeeId);
      formData.append("report_date", formState.reportDate);
      formData.append("store_id", formState.storeId);
      formData.append("photo_type", photoType);

      const res = await fetch("/api/admin/pc-reports/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await res.json();
      return {
        photoUrl: data.photo_url,
        storagePath: data.storage_path,
      };
    },
    [formState.employeeId, formState.reportDate, formState.storeId]
  );

  // Auto-save draft
  const saveDraft = useCallback(async () => {
    if (!formState.employeeId || !formState.storeId) return;

    // Check if data has changed
    const currentData = JSON.stringify({
      customerActivities: formState.customerActivities,
      competitorPromoNotes: formState.competitorPromoNotes,
      storePromoNotes: formState.storePromoNotes,
      competitorPromoPhotos: formState.competitorPromoPhotos,
      storePromoPhotos: formState.storePromoPhotos,
    });

    if (currentData === lastSaveDataRef.current) {
      return; // No changes
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      // Get employee and store names
      const employee = employees.find((e) => e.id === formState.employeeId);
      const store = stores.find((s) => s.id === formState.storeId);

      if (!employee || !store) {
        throw new Error("Employee or store not found");
      }

      // Save report
      const reportRes = await fetch("/api/admin/pc-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_date: formState.reportDate,
          employee_id: formState.employeeId,
          store_id: formState.storeId,
          customer_activities: formState.customerActivities,
          competitor_promo_notes: formState.competitorPromoNotes,
          store_promo_notes: formState.storePromoNotes,
          status: "draft",
        }),
      });

      if (!reportRes.ok) {
        throw new Error("Failed to save report");
      }

      const reportData = await reportRes.json();
      const reportId = reportData.report.id;

      if (!formState.reportId) {
        setFormState((prev) => ({ ...prev, reportId }));
      }

      // Save shelf photos
      if (formState.shelfPhotos.length > 0 && !formState.reportId) {
        const photosToSave = formState.shelfPhotos.filter((p) => p.photoUrl);
        if (photosToSave.length > 0) {
          await fetch(`/api/admin/pc-reports/${reportId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photos: photosToSave.map((p) => ({
                photo_url: p.photoUrl,
                storage_path: p.storagePath,
                caption: p.caption,
                uploaded_at: p.uploadedAt,
              })),
            }),
          });
        }
      }

      // Save stock usage
      if (formState.stockItems.length > 0 && !formState.reportId) {
        await fetch(`/api/admin/pc-reports/${reportId}/stock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stock_items: formState.stockItems.map((item) => ({
              product_id: item.productId,
              quantities: item.quantities,
            })),
          }),
        });
      }

      lastSaveDataRef.current = currentData;
      setSaveMessage("บันทึกร่างอัตโนมัติแล้ว");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error("Auto-save failed:", error);
      setSaveMessage("บันทึกร่างล้มเหลว");
    } finally {
      setSaving(false);
    }
  }, [formState, employees, stores]);

  // Trigger auto-save on form changes (debounced)
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      if (formState.employeeId && formState.storeId) {
        saveDraft();
      }
    }, 30000); // 30 seconds

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    formState.customerActivities,
    formState.competitorPromoNotes,
    formState.storePromoNotes,
    formState.competitorPromoPhotos,
    formState.storePromoPhotos,
    saveDraft,
    formState.employeeId,
    formState.storeId,
  ]);

  // Submit report
  const handleSubmit = async (status: "draft" | "submitted") => {
    if (!formState.employeeId) {
      alert("กรุณาเลือกพนักงาน");
      return;
    }

    if (!formState.storeId) {
      alert("กรุณาเลือกร้าน");
      return;
    }

    // Validate required fields for submission
    if (status === "submitted") {
      if (formState.shelfPhotos.length === 0) {
        alert("กรุณาอัปโหลดรูปชั้นวางอย่างน้อย 1 รูป");
        return;
      }

      if (!formState.customerActivities.trim()) {
        alert("กรุณากรอกกิจกรรมลูกค้า");
        return;
      }
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const employee = employees.find((e) => e.id === formState.employeeId);
      const store = stores.find((s) => s.id === formState.storeId);

      if (!employee || !store) {
        throw new Error("Employee or store not found");
      }

      // Save report
      const reportRes = await fetch("/api/admin/pc-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_date: formState.reportDate,
          employee_id: formState.employeeId,
          store_id: formState.storeId,
          customer_activities: formState.customerActivities,
          competitor_promo_notes: formState.competitorPromoNotes,
          store_promo_notes: formState.storePromoNotes,
          status,
        }),
      });

      if (!reportRes.ok) {
        const error = await reportRes.json();
        throw new Error(error.error || "Failed to save report");
      }

      const reportData = await reportRes.json();
      const reportId = reportData.report.id;

      // Save shelf photos if new
      if (formState.shelfPhotos.length > 0 && !formState.reportId) {
        const photosToSave = formState.shelfPhotos.filter((p) => p.photoUrl);
        if (photosToSave.length > 0) {
          await fetch(`/api/admin/pc-reports/${reportId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photos: photosToSave.map((p) => ({
                photo_url: p.photoUrl,
                storage_path: p.storagePath,
                caption: p.caption,
                uploaded_at: p.uploadedAt,
              })),
            }),
          });
        }
      }

      // Save stock usage if new
      if (formState.stockItems.length > 0 && !formState.reportId) {
        await fetch(`/api/admin/pc-reports/${reportId}/stock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stock_items: formState.stockItems.map((item) => ({
              product_id: item.productId,
              quantities: item.quantities,
            })),
          }),
        });
      }

      // Show success message
      if (status === "submitted") {
        alert("✅ บันทึกรายงานเสร็จสิ้น");
        // Reset form or redirect
        window.location.reload();
      } else {
        setSaveMessage("💾 บันทึกร่างแล้ว");
        setTimeout(() => setSaveMessage(null), 3000);
      }

      setFormState((prev) => ({ ...prev, reportId, status }));
    } catch (error) {
      console.error("Submit failed:", error);
      alert(`บันทึกล้มเหลว: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const _selectedEmployee = employees.find((e) => e.id === formState.employeeId);
  const availableStores = formState.employeeId
    ? employeeStoresQuery.data || []
    : stores;

  const canSubmit =
    formState.employeeId &&
    formState.storeId &&
    !saving &&
    !loadingProducts;

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteNav />

      <main className="container mx-auto px-4 pt-20 pb-10 sm:pt-24 sm:pb-10 max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            บันทึกรายงาน PC รายวัน
          </h1>
          <p className="text-sm text-gray-600">
            กรอกข้อมูลรายงานประจำวันสำหรับ Product Consultant
          </p>
        </header>

        {/* Status Banner */}
        {saveMessage && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            {saveMessage}
          </div>
        )}

        {/* Form */}
        <div className="space-y-6">
          {/* Section 1: Basic Info */}
          <section className="bg-white p-4 rounded-lg shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วันที่
              </label>
              <input
                type="date"
                value={formState.reportDate}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    reportDate: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                พนักงาน
              </label>
              <select
                value={formState.employeeId}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    employeeId: e.target.value,
                    storeId: "", // Reset store when employee changes
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={saving}
              >
                <option value="">-- เลือกพนักงาน --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                    {emp.employeeCode && ` (${emp.employeeCode})`}
                  </option>
                ))}
              </select>
            </div>

            {formState.employeeId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ร้าน
                </label>
                {employeeStoresQuery.isLoading ? (
                  <p className="text-sm text-gray-500">กำลังโหลดร้าน...</p>
                ) : availableStores.length === 0 ? (
                  <p className="text-sm text-red-600">
                    พนักงานนี้ยังไม่ได้รับมอบหมายร้านใดๆ
                  </p>
                ) : (
                  <select
                    value={formState.storeId}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        storeId: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={saving}
                  >
                    <option value="">-- เลือกร้าน --</option>
                    {availableStores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                        {store.province && ` (${store.province})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </section>

          {/* Show remaining sections only when employee + store selected */}
          {formState.employeeId && formState.storeId && (
            <>
              {/* Section 2: Shelf Photos */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <ShelfPhotosSection
                  photos={formState.shelfPhotos}
                  onChange={(photos) =>
                    setFormState((prev) => ({ ...prev, shelfPhotos: photos }))
                  }
                  onUpload={(file) => uploadPhoto(file, "shelf")}
                  disabled={saving}
                />
              </div>

              {/* Section 3: Stock Usage */}
              {loadingProducts ? (
                <div className="bg-white p-4 rounded-lg shadow-sm text-center">
                  <p className="text-gray-600">กำลังโหลดรายการสินค้า...</p>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <StockUsageSection
                    stockItems={formState.stockItems}
                    products={products}
                    onChange={(items) =>
                      setFormState((prev) => ({ ...prev, stockItems: items }))
                    }
                    disabled={saving}
                  />
                </div>
              )}

              {/* Section 4: Customer Activities */}
              <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  👥 กิจกรรมลูกค้า
                </h2>
                <textarea
                  value={formState.customerActivities}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      customerActivities: e.target.value,
                    }))
                  }
                  placeholder="ลูกค้ารายที่ 1&#10;- สั่งออนไลน์ กุ้ง 400g 2ห่อ&#10;- แนะนำ ขนมไฮไรซ์ ซื้อ 1 แพ็ค&#10;&#10;ลูกค้ารายที่ 2&#10;- เข้ามาเลือกซื้อ..."
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={saving}
                />
                <p className="text-xs text-gray-500">
                  {formState.customerActivities.length} ตัวอักษร
                </p>
              </div>

              {/* Section 5: Competitor Promotion */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <PromotionSection
                  title="โปรโมชั่นคู่แข่ง"
                  icon="🎯"
                  photos={formState.competitorPromoPhotos}
                  notes={formState.competitorPromoNotes}
                  onPhotosChange={(photos) =>
                    setFormState((prev) => ({
                      ...prev,
                      competitorPromoPhotos: photos,
                    }))
                  }
                  onNotesChange={(notes) =>
                    setFormState((prev) => ({
                      ...prev,
                      competitorPromoNotes: notes,
                    }))
                  }
                  onUpload={(file) => uploadPhoto(file, "competitor")}
                  disabled={saving}
                  placeholder="บันทึกรายละเอียดโปรโมชั่นคู่แข่ง เช่น ลดราคา แถม ของแถม..."
                />
              </div>

              {/* Section 6: Store Promotion */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <PromotionSection
                  title="โปรโมชั่นร้านเรา"
                  icon="🏪"
                  photos={formState.storePromoPhotos}
                  notes={formState.storePromoNotes}
                  onPhotosChange={(photos) =>
                    setFormState((prev) => ({
                      ...prev,
                      storePromoPhotos: photos,
                    }))
                  }
                  onNotesChange={(notes) =>
                    setFormState((prev) => ({
                      ...prev,
                      storePromoNotes: notes,
                    }))
                  }
                  onUpload={(file) => uploadPhoto(file, "store-promo")}
                  disabled={saving}
                  placeholder="บันทึกรายละเอียดโปรโมชั่นร้าน การจัดชั้นวาง การตกแต่ง..."
                />
              </div>

              {/* Action Buttons */}
              <div className="sticky bottom-0 bg-white p-4 rounded-lg shadow-lg border-t-2 border-blue-500">
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSubmit("draft")}
                    disabled={!canSubmit}
                    className="flex-1 py-3 px-4 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? "กำลังบันทึก..." : "💾 บันทึกร่าง"}
                  </button>
                  <button
                    onClick={() => handleSubmit("submitted")}
                    disabled={!canSubmit}
                    className="flex-1 py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? "กำลังบันทึก..." : "✅ บันทึกเสร็จสิ้น"}
                  </button>
                </div>

                {formState.status === "submitted" && (
                  <p className="text-center text-sm text-green-600 mt-2">
                    รายงานนี้ถูกส่งแล้ว
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
