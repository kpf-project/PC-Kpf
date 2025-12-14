"use client";

import { Plus, Save, RefreshCw, Trash2, Package } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";
import type { FormEvent } from "react";
import CompanySelector from "@/components/company/CompanySelector";

export interface CatalogUnitForm {
  id?: string;
  name: string;
  sku: string;
  multiplierToBase: string;
  isBase: boolean;
}

export interface CatalogFormState {
  id?: string;
  code: string;
  name: string;
  description: string;
  companyId: string | null;
  isActive: boolean;
  units: CatalogUnitForm[];
}

interface ProductFormProps {
  formState: CatalogFormState;
  onFormChange: (state: CatalogFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onReset: () => void;
  isSaving: boolean;
  onAddUnit: () => void;
  onUpdateUnit: (index: number, update: Partial<CatalogUnitForm>) => void;
  onRemoveUnit: (index: number) => void;
}

export default function ProductForm({
  formState,
  onFormChange,
  onSubmit,
  onReset,
  isSaving,
  onAddUnit,
  onUpdateUnit,
  onRemoveUnit
}: ProductFormProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-full space-y-4 overflow-hidden rounded-3xl border-2 border-white/60 bg-white/40 p-3 shadow-[0_8px_32px_rgba(56,189,248,0.08)] backdrop-blur-xl sm:space-y-6 sm:p-4 lg:p-6"
    >
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30">
          <Package className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            {formState.id ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}
          </h3>
          <p className="text-sm text-slate-500">กรอกข้อมูลสินค้าและหน่วยขาย</p>
        </div>
        {formState.id && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="ml-auto rounded-full bg-sky-100 px-4 py-1.5 text-xs font-bold text-sky-600"
          >
            โหมดแก้ไข
          </motion.span>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative">
            <input
              required
              type="text"
              id="productCode"
              value={formState.code}
              onChange={(e) => onFormChange({ ...formState, code: e.target.value })}
              placeholder="รหัสสินค้า"
              className="peer w-full rounded-2xl border-2 border-sky-200 bg-white/80 px-4 py-3.5 text-base text-slate-900 placeholder-transparent transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
            />
            <label
              htmlFor="productCode"
              className="absolute -top-2.5 left-3 bg-white px-2 text-sm font-semibold text-sky-600 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-sky-600"
            >
              รหัสสินค้า
            </label>
          </div>

          <div className="relative">
            <input
              required
              type="text"
              id="productName"
              value={formState.name}
              onChange={(e) => onFormChange({ ...formState, name: e.target.value })}
              placeholder="ชื่อสินค้า"
              className="peer w-full rounded-2xl border-2 border-sky-200 bg-white/80 px-4 py-3.5 text-base text-slate-900 placeholder-transparent transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
            />
            <label
              htmlFor="productName"
              className="absolute -top-2.5 left-3 bg-white px-2 text-sm font-semibold text-sky-600 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-sky-600"
            >
              ชื่อสินค้า
            </label>
          </div>

          <div className="relative md:col-span-2">
            <textarea
              id="productDescription"
              value={formState.description}
              onChange={(e) => onFormChange({ ...formState, description: e.target.value })}
              placeholder="รายละเอียด"
              rows={3}
              className="peer w-full rounded-2xl border-2 border-sky-200 bg-white/80 px-4 py-3.5 text-base text-slate-900 placeholder-transparent transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
            />
            <label
              htmlFor="productDescription"
              className="absolute -top-2.5 left-3 bg-white px-2 text-sm font-semibold text-sky-600 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-sky-600"
            >
              รายละเอียด (ไม่บังคับ)
            </label>
          </div>

          <div className="md:col-span-2">
            <CompanySelector
              value={formState.companyId}
              onChange={(companyId) => onFormChange({ ...formState, companyId })}
              label="บริษัท"
              placeholder="เลือกบริษัท (ไม่บังคับ)"
              required={false}
              includeAllOption={false}
              size="md"
            />
          </div>

          <label className="flex items-center gap-3 md:col-span-2">
            <input
              type="checkbox"
              checked={formState.isActive}
              onChange={(e) => onFormChange({ ...formState, isActive: e.target.checked })}
              className="h-5 w-5 cursor-pointer rounded-lg border-2 border-sky-300 text-sky-600 transition-all focus:ring-4 focus:ring-sky-500/30"
            />
            <span className="text-sm font-semibold text-slate-700">เปิดใช้งานสินค้า</span>
          </label>
        </div>

        {/* Units Section */}
        <div className="rounded-2xl border-2 border-sky-200 bg-gradient-to-br from-sky-50/50 to-blue-50/30 p-3 sm:p-4 lg:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-900">หน่วยขาย</h4>
              <p className="text-xs text-slate-600">กำหนดหน่วยต่าง ๆ และตัวคูณสำหรับคำนวณสต็อก</p>
            </div>
            <button
              type="button"
              onClick={onAddUnit}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition-all hover:from-sky-600 hover:to-blue-700"
            >
              <Plus className="h-4 w-4" />
              เพิ่มหน่วย
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {formState.units.map((unit, index) => {
              const multiplierValue = unit.isBase ? "1" : unit.multiplierToBase;
              const multiplierNumber = Number.parseFloat(multiplierValue || "0");
              const multiplierLabel =
                Number.isFinite(multiplierNumber) && multiplierNumber > 0 ? multiplierNumber : 0;
              const canRemove = formState.units.length > 1;

              return (
                <motion.div
                  key={unit.id ?? `unit-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl border-2 border-white bg-white p-3 shadow-sm sm:p-4"
                >
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px]">
                    <div className="relative">
                      <input
                        required
                        type="text"
                        value={unit.name}
                        onChange={(e) => onUpdateUnit(index, { name: e.target.value })}
                        placeholder="ชื่อหน่วย"
                        className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2.5 text-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      />
                      <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-semibold text-sky-600">
                        ชื่อหน่วย
                      </label>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={unit.sku}
                        onChange={(e) => onUpdateUnit(index, { sku: e.target.value })}
                        placeholder="SKU"
                        className="w-full rounded-xl border-2 border-sky-200 bg-white px-3 py-2.5 text-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                      />
                      <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-semibold text-sky-600">
                        SKU (ไม่บังคับ)
                      </label>
                    </div>

                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={multiplierValue}
                        onChange={(e) => onUpdateUnit(index, { multiplierToBase: e.target.value })}
                        disabled={unit.isBase}
                        className={clsx(
                          "w-full rounded-xl border-2 px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2",
                          unit.isBase
                            ? "border-sky-300 bg-sky-50 text-sky-700 focus:ring-sky-300"
                            : "border-sky-200 bg-white focus:border-sky-500 focus:ring-sky-500/20"
                        )}
                      />
                      <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-semibold text-sky-600">
                        ตัวคูณ (ซอง)
                      </label>
                      <p className="mt-1 text-[10px] text-slate-500">
                        = {multiplierLabel.toLocaleString("th-TH")} ซอง
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onUpdateUnit(index, { isBase: true })}
                      className={clsx(
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                        unit.isBase
                          ? "bg-sky-100 text-sky-700 ring-2 ring-sky-300"
                          : "border-2 border-sky-200 text-sky-600 hover:bg-sky-50"
                      )}
                    >
                      {unit.isBase ? "✓ หน่วยฐาน (ซอง)" : "ตั้งเป็นหน่วยฐาน"}
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveUnit(index)}
                      disabled={!canRemove}
                      className={clsx(
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                        canRemove
                          ? "border-2 border-red-200 text-red-600 hover:bg-red-50"
                          : "border-2 border-slate-200 text-slate-300 cursor-not-allowed"
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      ลบหน่วย
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            ล้างแบบฟอร์ม
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition-all hover:from-sky-600 hover:to-blue-700 hover:shadow-xl hover:shadow-sky-500/40 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                บันทึกสินค้า
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
