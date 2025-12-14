"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Upload,
} from "lucide-react";
import clsx from "clsx";

interface Company {
  id: string;
  name: string;
  code: string | null;
  logoUrl: string | null;
  description: string | null;
  primaryColor: string;
  secondaryColor: string;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export default function CompaniesPageClient() {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    primaryColor: "#3b82f6",
    secondaryColor: "#0ea5e9",
  });

  // Logo upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Fetch companies
  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await fetch("/api/admin/companies");
      if (!res.ok) throw new Error("Failed to fetch companies");
      const result = await res.json();
      return result.companies || [];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (
      data: typeof formData & { id?: string; logoUrl?: string | null; logoData?: string | null }
    ) => {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save company");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      closeModal();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/companies?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete company");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch("/api/admin/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle company status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  // Handle logo file change
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 2MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }

    setLogoFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Remove logo
  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  // Convert file to base64 data URL
  const convertFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์รูปภาพได้"));
      reader.readAsDataURL(file);
    });
  };

  const openModal = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name,
        code: company.code || "",
        description: company.description || "",
        primaryColor: company.primaryColor,
        secondaryColor: company.secondaryColor,
      });
      // Set existing logo preview
      setLogoPreview(company.logoUrl);
      setLogoFile(null);
    } else {
      setEditingCompany(null);
      setFormData({
        name: "",
        code: "",
        description: "",
        primaryColor: "#3b82f6",
        secondaryColor: "#0ea5e9",
      });
      // Clear logo state
      setLogoFile(null);
      setLogoPreview(null);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCompany(null);
    setLogoFile(null);
    setLogoPreview(null);
    saveMutation.reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsUploadingLogo(true);

      let logoData: string | null = null;
      const logoUrl = editingCompany?.logoUrl || null;

      // Convert logo file to base64 if new file selected
      if (logoFile) {
        logoData = await convertFileToDataUrl(logoFile);
      }

      // Save company data (API will handle logo upload if logoData provided)
      saveMutation.mutate({
        ...formData,
        logoUrl, // Keep existing URL if no new file
        logoData, // Base64 data for new upload
        ...(editingCompany && { id: editingCompany.id }),
      });
    } catch (error) {
      console.error("Error preparing logo:", error);
      alert(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการเตรียมรูปภาพ");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDelete = (company: Company) => {
    if (company.productCount && company.productCount > 0) {
      alert(
        `ไม่สามารถลบบริษัท "${company.name}" ได้ เนื่องจากมีสินค้าที่เชื่อมโยงอยู่ ${company.productCount} รายการ\n\nกรุณาลบหรือเปลี่ยนบริษัทของสินค้าเหล่านั้นก่อน`
      );
      return;
    }

    if (
      confirm(
        `ยืนยันการลบบริษัท "${company.name}"?\n\nการดำเนินการนี้ไม่สามารถย้อนกลับได้`
      )
    ) {
      deleteMutation.mutate(company.id);
    }
  };

  const filteredCompanies = companies.filter((company) =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 md:text-3xl">
              <Building2 className="h-8 w-8 text-blue-600" />
              จัดการบริษัท
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              จัดการรายการบริษัทสำหรับระบบหลายบริษัท
            </p>
          </div>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl active:scale-95"
          >
            <Plus className="h-5 w-5" />
            เพิ่มบริษัทใหม่
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="ค้นหาบริษัท..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border-2 border-blue-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredCompanies.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-blue-200 bg-white p-12 text-center">
            <Building2 className="mx-auto h-16 w-16 text-slate-300" />
            <p className="mt-4 text-lg font-semibold text-slate-600">
              {searchTerm ? "ไม่พบบริษัทที่ค้นหา" : "ยังไม่มีบริษัทในระบบ"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {searchTerm
                ? "ลองค้นหาด้วยคำอื่น"
                : "เริ่มต้นโดยการเพิ่มบริษัทใหม่"}
            </p>
          </div>
        )}

        {/* Companies Grid */}
        {!isLoading && filteredCompanies.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                className={clsx(
                  "group relative overflow-hidden rounded-3xl border-2 bg-white p-6 shadow-md transition-all hover:shadow-xl",
                  company.isActive
                    ? "border-blue-200"
                    : "border-slate-200 opacity-60"
                )}
              >
                {/* Status Badge */}
                <div className="absolute right-4 top-4">
                  {company.isActive ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      ใช้งาน
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      ปิดใช้งาน
                    </span>
                  )}
                </div>

                {/* Company Info */}
                <div className="mb-4">
                  {company.logoUrl && (
                    <Image
                      src={company.logoUrl}
                      alt={company.name}
                      width={64}
                      height={64}
                      className="mb-4 h-16 w-16 rounded-xl object-contain ring-2 ring-white shadow-md"
                      unoptimized
                      loading="lazy"
                    />
                  )}
                  <h3 className="text-xl font-bold text-slate-900">
                    {company.name}
                  </h3>
                  {company.code && (
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      รหัส: {company.code}
                    </p>
                  )}
                  {company.description && (
                    <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                      {company.description}
                    </p>
                  )}
                </div>

                {/* Product Count */}
                {company.productCount !== undefined && (
                  <div className="mb-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-2">
                    <p className="text-center text-sm font-semibold text-blue-900">
                      {company.productCount} สินค้า
                    </p>
                  </div>
                )}

                {/* Colors Preview */}
                <div className="mb-4 flex gap-2">
                  <div
                    className="h-8 flex-1 rounded-lg shadow-inner"
                    style={{ backgroundColor: company.primaryColor }}
                    title={`สีหลัก: ${company.primaryColor}`}
                  />
                  <div
                    className="h-8 flex-1 rounded-lg shadow-inner"
                    style={{ backgroundColor: company.secondaryColor }}
                    title={`สีรอง: ${company.secondaryColor}`}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openModal(company)}
                    className="flex-1 rounded-xl bg-blue-100 px-4 py-2 font-medium text-blue-700 transition-all hover:bg-blue-200 active:scale-95"
                  >
                    <Edit className="mx-auto h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      toggleActiveMutation.mutate({
                        id: company.id,
                        isActive: !company.isActive,
                      })
                    }
                    disabled={toggleActiveMutation.isPending}
                    className={clsx(
                      "flex-1 rounded-xl px-4 py-2 font-medium transition-all active:scale-95",
                      company.isActive
                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    )}
                  >
                    {company.isActive ? (
                      <PowerOff className="mx-auto h-4 w-4" />
                    ) : (
                      <Power className="mx-auto h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(company)}
                    disabled={deleteMutation.isPending}
                    className="flex-1 rounded-xl bg-rose-100 px-4 py-2 font-medium text-rose-700 transition-all hover:bg-rose-200 active:scale-95"
                  >
                    <Trash2 className="mx-auto h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingCompany ? "แก้ไขบริษัท" : "เพิ่มบริษัทใหม่"}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  ชื่อบริษัท <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full rounded-2xl border-2 border-blue-200 bg-white px-4 py-3 text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  placeholder="ระบุชื่อบริษัท"
                />
              </div>

              {/* Code */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  รหัสบริษัท
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  className="w-full rounded-2xl border-2 border-blue-200 bg-white px-4 py-3 text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  placeholder="เช่น ABC, XYZ (ไม่บังคับ)"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  คำอธิบาย
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-2xl border-2 border-blue-200 bg-white px-4 py-3 text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                />
              </div>

              {/* Logo Upload */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  โลโก้บริษัท
                </label>
                <div className="space-y-3">
                  {/* Logo Preview */}
                  {logoPreview && (
                    <div className="relative inline-block">
                      <Image
                        src={logoPreview}
                        alt="Logo preview"
                        width={120}
                        height={120}
                        className="h-30 w-30 rounded-2xl border-2 border-blue-200 object-contain bg-white p-3 shadow-md"
                        loading="lazy"
                        placeholder="empty"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition hover:bg-rose-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* File Input */}
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 px-4 py-3 transition hover:border-blue-400 hover:bg-blue-100">
                    <Upload className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900">
                        {logoPreview ? "เปลี่ยนโลโก้" : "อัปโหลดโลโก้"}
                      </p>
                      <p className="text-xs text-blue-600">
                        รองรับ JPG, PNG (ขนาดไม่เกิน 2MB)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Colors */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    สีหลัก
                  </label>
                  <input
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) =>
                      setFormData({ ...formData, primaryColor: e.target.value })
                    }
                    className="h-12 w-full cursor-pointer rounded-2xl border-2 border-blue-200"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    สีรอง
                  </label>
                  <input
                    type="color"
                    value={formData.secondaryColor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        secondaryColor: e.target.value,
                      })
                    }
                    className="h-12 w-full cursor-pointer rounded-2xl border-2 border-blue-200"
                  />
                </div>
              </div>

              {/* Error Message */}
              {saveMutation.isError && (
                <div className="rounded-xl bg-rose-50 border-2 border-rose-200 p-4">
                  <p className="text-sm font-medium text-rose-700">
                    {saveMutation.error instanceof Error
                      ? saveMutation.error.message
                      : "เกิดข้อผิดพลาดในการบันทึก"}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending || isUploadingLogo}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl active:scale-95 disabled:opacity-50"
                >
                  {isUploadingLogo ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      กำลังอัปโหลดรูปภาพ...
                    </span>
                  ) : saveMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      กำลังบันทึก...
                    </span>
                  ) : (
                    "บันทึก"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
