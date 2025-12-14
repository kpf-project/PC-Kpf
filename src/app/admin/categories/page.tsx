"use client";

import { useEffect, useMemo, useState } from "react";
import type { Category as CategoryRecord } from "@/lib/supabaseCategories";
import { Search, Plus, Edit, Trash2, Tag, Palette } from "lucide-react";

type DraftCategory = Pick<CategoryRecord, "id" | "name" | "color" | "createdAt" | "updatedAt">;

const emptyCategory = {
  name: "",
  color: "#3b82f6", // blue-600
};

const PRESET_COLORS = [
  { name: "ฟ้า", value: "#3b82f6" },
  { name: "เขียว", value: "#10b981" },
  { name: "ม่วง", value: "#8b5cf6" },
  { name: "ชมพู", value: "#ec4899" },
  { name: "แสด", value: "#f59e0b" },
  { name: "แดง", value: "#ef4444" },
  { name: "น้ำเงิน", value: "#06b6d4" },
  { name: "ส้ม", value: "#f97316" },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<DraftCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Form states
  const [newCategory, setNewCategory] = useState({ ...emptyCategory });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState({ ...emptyCategory });

  useEffect(() => {
    void refreshData();
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const refreshData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/categories");

      if (!response.ok) {
        throw new Error("ไม่สามารถโหลดข้อมูลได้");
      }

      const data = (await response.json()) as { categories: DraftCategory[] };
      setCategories(data.categories ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลได้";
      setError(message);
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered Categories
  const filteredCategories = useMemo(() => {
    let result = categories;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((cat) => cat.name.toLowerCase().includes(query));
    }

    return result.sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [categories, searchQuery]);

  const handleCreate = async () => {
    const name = newCategory.name.trim();

    if (!name) {
      setError("กรุณากรอกชื่อหมวดหมู่");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color: newCategory.color,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถเพิ่มหมวดหมู่ได้");
      }

      setNewCategory({ ...emptyCategory });
      setSuccessMessage("เพิ่มหมวดหมู่เรียบร้อย");
      await refreshData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "ไม่สามารถเพิ่มหมวดหมู่ได้";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (category: DraftCategory) => {
    setEditingId(category.id);
    setEditingCategory({
      name: category.name,
      color: category.color,
    });
  };

  const handleUpdate = async (id: string) => {
    const name = editingCategory.name.trim();

    if (!name) {
      setError("กรุณากรอกชื่อหมวดหมู่");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color: editingCategory.color,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถแก้ไขหมวดหมู่ได้");
      }

      setEditingId(null);
      setSuccessMessage("อัปเดตหมวดหมู่เรียบร้อย");
      await refreshData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "ไม่สามารถแก้ไขหมวดหมู่ได้";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("ต้องการลบหมวดหมู่นี้หรือไม่? (สินค้าในหมวดหมู่นี้จะถูกตั้งเป็น 'ไม่มีหมวดหมู่')")) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "ไม่สามารถลบหมวดหมู่ได้");
      }

      setSuccessMessage("ลบหมวดหมู่เรียบร้อย");
      await refreshData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "ไม่สามารถลบหมวดหมู่ได้";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900">จัดการหมวดหมู่สินค้า</h1>
        <p className="text-sm text-slate-500">
          จัดการหมวดหมู่สินค้าสำหรับใช้ในการจัดกลุ่มสินค้า
        </p>
      </header>

      {/* Alerts */}
      {error && (
        <div className="rounded-3xl border border-blue-200 bg-blue-50/90 px-5 py-3 text-sm text-blue-700 shadow-inner">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="rounded-3xl border border-sky-200 bg-sky-50/80 px-5 py-3 text-sm text-sky-700 shadow-inner">
          {successMessage}
        </div>
      )}

      {/* Quick Stats */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-sky-50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-500 p-2">
              <Tag className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm text-slate-600">หมวดหมู่ทั้งหมด</div>
              <div className="text-2xl font-bold text-slate-900">{categories.length}</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-cyan-50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-sky-500 p-2">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm text-slate-600">หมวดหมู่ที่แสดงผล</div>
              <div className="text-2xl font-bold text-slate-900">{filteredCategories.length}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Add Category Form */}
      <section className="rounded-3xl border border-blue-100 bg-white/85 p-4 sm:p-5 shadow-inner shadow-blue-100/50">
        <h2 className="text-base sm:text-sm font-semibold text-slate-800 mb-4">เพิ่มหมวดหมู่ใหม่</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input
            type="text"
            value={newCategory.name}
            onChange={(e) => setNewCategory((prev) => ({ ...prev, name: e.target.value }))}
            className="form-input text-base"
            placeholder="ชื่อหมวดหมู่ *"
          />
          <div className="flex gap-2">
            <input
              type="color"
              value={newCategory.color}
              onChange={(e) => setNewCategory((prev) => ({ ...prev, color: e.target.value }))}
              className="h-12 sm:h-10 w-16 rounded-xl border border-slate-300 cursor-pointer"
              title="เลือกสี"
            />
            <select
              value={newCategory.color}
              onChange={(e) => setNewCategory((prev) => ({ ...prev, color: e.target.value }))}
              className="form-input text-base flex-1"
            >
              {PRESET_COLORS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={handleCreate}
            disabled={isSaving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-500 px-6 py-3 text-base sm:text-sm font-semibold text-white shadow-[0_20px_60px_-45px_rgba(37,99,235,1)] transition hover:shadow-[0_24px_70px_-50px_rgba(37,99,235,1)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
            เพิ่มหมวดหมู่
          </button>
        </div>
      </section>

      {/* Search */}
      <section className="rounded-3xl border border-slate-200 bg-white/80 p-4 sm:p-5 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 sm:h-4 sm:w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input pl-10 text-base h-12 sm:h-auto"
            placeholder="ค้นหาหมวดหมู่..."
          />
        </div>
      </section>

      {/* Categories List */}
      <section className="space-y-4 rounded-3xl border border-white/70 bg-white/80 p-4 sm:p-5 shadow-[0_24px_90px_-60px_rgba(37,99,235,0.35)]">
        <h2 className="text-base sm:text-sm font-semibold text-slate-800">
          รายการหมวดหมู่ ({filteredCategories.length})
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-blue-200 px-4 py-8 text-center text-sm text-blue-500">
            {categories.length === 0
              ? "ยังไม่มีหมวดหมู่ เพิ่มได้ด้านบน"
              : "ไม่พบหมวดหมู่ที่ค้นหา"}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCategories.map((category) => {
              const isEditing = editingId === category.id;

              return (
                <div
                  key={category.id}
                  className="rounded-2xl border border-blue-100 bg-white px-4 py-4"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory((prev) => ({ ...prev, name: e.target.value }))}
                        className="form-input text-base"
                        placeholder="ชื่อหมวดหมู่"
                      />
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={editingCategory.color}
                          onChange={(e) => setEditingCategory((prev) => ({ ...prev, color: e.target.value }))}
                          className="h-10 w-16 rounded-xl border border-slate-300 cursor-pointer"
                        />
                        <select
                          value={editingCategory.color}
                          onChange={(e) => setEditingCategory((prev) => ({ ...prev, color: e.target.value }))}
                          className="form-input text-base flex-1"
                        >
                          {PRESET_COLORS.map((preset) => (
                            <option key={preset.value} value={preset.value}>
                              {preset.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleUpdate(category.id)}
                          disabled={isSaving}
                          className="flex-1 rounded-full bg-sky-100 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-200"
                        >
                          บันทึก
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditingCategory({ ...emptyCategory });
                          }}
                          className="flex-1 rounded-full bg-blue-100 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-200"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-full border-2 border-white shadow-lg"
                          style={{ backgroundColor: category.color }}
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900 text-base leading-snug">
                            {category.name}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">{category.color}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-blue-100">
                        <button
                          type="button"
                          onClick={() => handleEdit(category)}
                          className="rounded-xl bg-sky-100 py-2.5 text-sm font-semibold text-sky-600 hover:bg-sky-200 transition-colors"
                        >
                          <Edit className="h-4 w-4 inline mr-1" />
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(category.id)}
                          disabled={isSaving}
                          className="rounded-xl bg-blue-200 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-300 disabled:opacity-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4 inline mr-1" />
                          ลบ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
