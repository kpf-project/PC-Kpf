"use client";

import { useState, useEffect, useMemo } from "react";
import {
  User, Phone, MapPin, Search, Plus, X, Trash2, Edit2,
  Calendar, Filter, Sparkles, ChevronDown, ChevronUp, Building2
} from "lucide-react";
import type { EmployeeRecord, StoreRecord } from "@/lib/supabaseDirectory";
import { THAI_PROVINCES, REGION_BY_PROVINCE } from "@/lib/thaiGeography";
import { useModal } from "@/contexts/ModalContext";

type DraftEmployee = Pick<
  EmployeeRecord,
  | "id"
  | "name"
  | "employeeCode"
  | "phone"
  | "regularDayOff"
  | "province"
  | "region"
  | "defaultStoreId"
  | "createdAt"
  | "updatedAt"
>;

type EmployeeFormState = {
  name: string;
  employeeCode: string;
  phone: string;
  regularDayOff: string;
  province: string;
  region: string;
  defaultStoreId: string;
  selectedStoreIds: string[];
  primaryStoreId: string;
};

const EMPTY_FORM: EmployeeFormState = {
  name: "",
  employeeCode: "",
  phone: "",
  regularDayOff: "",
  province: "",
  region: "",
  defaultStoreId: "",
  selectedStoreIds: [],
  primaryStoreId: "",
};

const DAY_OFF_OPTIONS = [
  "",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
  "อาทิตย์",
  "สลับ/ไม่แน่นอน",
];

interface EmployeeStoreAssignment {
  id: string;
  employeeId: string;
  storeId: string;
  storeName: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function EmployeesPagePremium() {
  const { openModal, closeModal } = useModal();
  const [employees, setEmployees] = useState<DraftEmployee[]>([]);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // UI States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProvince, setFilterProvince] = useState("");
  const [editingEmployee, setEditingEmployee] = useState<DraftEmployee | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedStoreRows, setExpandedStoreRows] = useState<Set<string>>(new Set());

  // Form States
  const [addForm, setAddForm] = useState<EmployeeFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<EmployeeFormState>(EMPTY_FORM);

  // Store Assignments
  const [allEmployeeAssignments, setAllEmployeeAssignments] = useState<Map<string, EmployeeStoreAssignment[]>>(new Map());

  // Load data
  useEffect(() => {
    void loadEmployees();
    void loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Sync Add Modal with ModalContext
  useEffect(() => {
    const MODAL_ID = 'employee-add-modal';
    if (isAddModalOpen) {
      openModal(MODAL_ID);
    } else {
      closeModal(MODAL_ID);
    }

    return () => {
      // Cleanup: always close modal on unmount
      closeModal(MODAL_ID);
    };
  }, [isAddModalOpen, openModal, closeModal]);

  // Sync Edit Modal with ModalContext
  useEffect(() => {
    const MODAL_ID = 'employee-edit-modal';
    if (isEditModalOpen) {
      openModal(MODAL_ID);
    } else {
      closeModal(MODAL_ID);
    }

    return () => {
      // Cleanup: always close modal on unmount
      closeModal(MODAL_ID);
    };
  }, [isEditModalOpen, openModal, closeModal]);

  const loadEmployees = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/employees");
      if (!response.ok) throw new Error("ไม่สามารถโหลดข้อมูลได้");
      const data = await response.json();
      const empList = Array.isArray(data.employees) ? data.employees : [];
      setEmployees(empList);

      // Load assignments for all employees
      if (empList.length > 0) {
        await loadAllAssignments(empList.map((e: DraftEmployee) => e.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsLoading(false);
    }
  };

  const loadStores = async () => {
    try {
      const response = await fetch("/api/admin/stores");
      if (!response.ok) throw new Error("ไม่สามารถโหลดร้านค้าได้");
      const data = await response.json();
      setStores(Array.isArray(data.stores) ? data.stores : []);
    } catch (err) {
      console.error("Failed to load stores:", err);
    }
  };

  const loadEmployeeAssignments = async (employeeId: string) => {
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}/stores`);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data.assignments) ? data.assignments : [];
    } catch (err) {
      console.error("Failed to load assignments:", err);
      return [];
    }
  };

  const loadAllAssignments = async (employeeIds: string[]) => {
    const results = await Promise.all(
      employeeIds.map(async (id) => ({
        id,
        assignments: await loadEmployeeAssignments(id)
      }))
    );
    const map = new Map<string, EmployeeStoreAssignment[]>();
    results.forEach(({ id, assignments }) => {
      map.set(id, assignments);
    });
    setAllEmployeeAssignments(map);
  };

  const toggleStoreSelection = (storeId: string, formSetter: React.Dispatch<React.SetStateAction<EmployeeFormState>>) => {
    formSetter(prev => {
      const isSelected = prev.selectedStoreIds.includes(storeId);
      if (isSelected) {
        // Remove
        return {
          ...prev,
          selectedStoreIds: prev.selectedStoreIds.filter(id => id !== storeId),
          primaryStoreId: prev.primaryStoreId === storeId ? "" : prev.primaryStoreId
        };
      } else {
        // Add
        return {
          ...prev,
          selectedStoreIds: [...prev.selectedStoreIds, storeId]
        };
      }
    });
  };

  const setPrimaryStore = (storeId: string, formSetter: React.Dispatch<React.SetStateAction<EmployeeFormState>>) => {
    formSetter(prev => ({
      ...prev,
      primaryStoreId: storeId
    }));
  };

  const toggleStoreExpand = (employeeId: string) => {
    setExpandedStoreRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  const saveStoreAssignments = async (employeeId: string, selectedStoreIds: string[], primaryStoreId: string) => {
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}/stores`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeIds: selectedStoreIds,
          primaryStoreId: primaryStoreId || null
        })
      });
      if (!response.ok) throw new Error("ไม่สามารถบันทึกร้านค้าได้");
    } catch (err) {
      throw err;
    }
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) {
      setError("กรุณาระบุชื่อพนักงาน");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          employeeCode: addForm.employeeCode.trim() || undefined,
          phone: addForm.phone.trim() || undefined,
          regularDayOff: addForm.regularDayOff || undefined,
          province: addForm.province || undefined,
          region: addForm.region || undefined,
          defaultStoreId: addForm.defaultStoreId || undefined,
        }),
      });

      if (!response.ok) throw new Error("ไม่สามารถเพิ่มพนักงานได้");

      const result = await response.json();
      const newEmployeeId = result.employee?.id;

      // Save store assignments if any
      if (newEmployeeId && addForm.selectedStoreIds.length > 0) {
        await saveStoreAssignments(newEmployeeId, addForm.selectedStoreIds, addForm.primaryStoreId);
      }

      setAddForm(EMPTY_FORM);
      setIsAddModalOpen(false);
      setSuccessMessage("✨ เพิ่มพนักงานสำเร็จ");
      await loadEmployees();
      if (newEmployeeId) {
        await loadAllAssignments([newEmployeeId]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.name.trim()) {
      setError("กรุณาระบุชื่อพนักงาน");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          employeeCode: editForm.employeeCode.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
          regularDayOff: editForm.regularDayOff || undefined,
          province: editForm.province || undefined,
          region: editForm.region || undefined,
          defaultStoreId: editForm.defaultStoreId || undefined,
        }),
      });

      if (!response.ok) throw new Error("ไม่สามารถอัปเดตได้");

      // Save store assignments
      if (editForm.selectedStoreIds.length > 0) {
        await saveStoreAssignments(id, editForm.selectedStoreIds, editForm.primaryStoreId);
      }

      setEditingEmployee(null);
      setIsEditModalOpen(false);
      setSuccessMessage("✨ อัปเดตพนักงานสำเร็จ");
      await loadEmployees();
      await loadAllAssignments([id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`ต้องการลบพนักงาน "${name}" หรือไม่?`)) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/employees/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("ไม่สามารถลบพนักงานได้");

      setSuccessMessage("✨ ลบพนักงานสำเร็จ");
      await loadEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSaving(false);
    }
  };

  const handleProvinceChange = (province: string, formSetter: React.Dispatch<React.SetStateAction<EmployeeFormState>>) => {
    formSetter(prev => ({
      ...prev,
      province,
      region: REGION_BY_PROVINCE.get(province) || "",
    }));
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchSearch = !searchQuery ||
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeeCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.phone?.includes(searchQuery);

      const matchProvince = !filterProvince || emp.province === filterProvince;

      return matchSearch && matchProvince;
    });
  }, [employees, searchQuery, filterProvince]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) =>
      a.name.localeCompare(b.name, "th-TH")
    );
  }, [filteredEmployees]);

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
              <User className="h-8 w-8 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">
                จัดการพนักงาน
              </h1>
              <p className="text-sm text-blue-50 mt-1">
                ระบบจัดการข้อมูลพนักงานแบบ Enterprise
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3">
              <p className="text-xs text-blue-100">พนักงานทั้งหมด</p>
              <p className="text-2xl font-bold text-white">{employees.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3">
              <p className="text-xs text-blue-100">พบในระบบ</p>
              <p className="text-2xl font-bold text-white">{filteredEmployees.length}</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3">
              <p className="text-xs text-blue-100">จังหวัด</p>
              <p className="text-2xl font-bold text-white">
                {new Set(employees.map(e => e.province).filter(Boolean)).size}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3">
              <p className="text-xs text-blue-100">ร้านค้า</p>
              <p className="text-2xl font-bold text-white">{stores.length}</p>
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
                placeholder="ค้นหาชื่อ, รหัส, เบอร์โทร..."
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
              <span className="hidden sm:inline">เพิ่มพนักงาน</span>
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
        ) : sortedEmployees.length === 0 ? (
          <div className="rounded-3xl bg-white/80 backdrop-blur-xl border-2 border-dashed border-blue-200 shadow-xl p-12 text-center">
            <Sparkles className="h-12 w-12 text-blue-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">
              {searchQuery || filterProvince ? "ไม่พบข้อมูลที่ค้นหา" : "ยังไม่มีพนักงานในระบบ"}
            </p>
            <p className="text-sm text-slate-400 mt-2">
              คลิกปุ่ม &ldquo;เพิ่มพนักงาน&rdquo; เพื่อเริ่มต้น
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
                        พนักงาน
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        รหัส
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        เบอร์โทร
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        จังหวัด
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        วันหยุด
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        ร้านค้า
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                        จัดการ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedEmployees.map((employee, index) => (
                      <tr
                        key={employee.id}
                        className="group hover:bg-blue-50/50 transition-all"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center shadow-lg">
                              <User className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{employee.name}</p>
                              <p className="text-xs text-slate-500">
                                สร้าง: {new Date(employee.createdAt).toLocaleDateString("th-TH")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700">
                            {employee.employeeCode || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {employee.phone ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                              <Phone className="h-3.5 w-3.5" />
                              {employee.phone}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {employee.province ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-xs font-medium text-blue-700">
                              <MapPin className="h-3 w-3" />
                              {employee.province}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {employee.regularDayOff ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                              <Calendar className="h-3.5 w-3.5" />
                              {employee.regularDayOff}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const assignments = allEmployeeAssignments.get(employee.id) || [];
                            const isExpanded = expandedStoreRows.has(employee.id);

                            if (assignments.length === 0) {
                              return <span className="text-xs text-slate-400">ยังไม่ผูกร้าน</span>;
                            }

                            return (
                              <div className="relative">
                                {/* Compact View */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleStoreExpand(employee.id);
                                  }}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all group"
                                >
                                  <Building2 className="h-3.5 w-3.5 text-blue-600" />
                                  <span className="text-xs font-medium text-blue-700">
                                    {assignments.length} ร้าน
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-3.5 w-3.5 text-blue-600" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
                                  )}
                                </button>

                                {/* Dropdown List */}
                                {isExpanded && (
                                  <div className="absolute z-50 left-0 top-full mt-2 min-w-[220px] rounded-xl bg-white border-2 border-blue-100 shadow-2xl shadow-blue-500/20 animate-slide-in">
                                    <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                                      {assignments.map(a => (
                                        <div
                                          key={a.id}
                                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                            a.isPrimary
                                              ? 'bg-emerald-50 border border-emerald-200'
                                              : 'hover:bg-slate-50'
                                          }`}
                                        >
                                          {a.isPrimary ? (
                                            <span className="text-emerald-600 text-sm">★</span>
                                          ) : (
                                            <span className="text-slate-300 text-sm">•</span>
                                          )}
                                          <span className={`text-xs font-medium flex-1 ${
                                            a.isPrimary ? 'text-emerald-700' : 'text-slate-700'
                                          }`}>
                                            {a.storeName}
                                          </span>
                                          {a.isPrimary && (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                                              หลัก
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setEditingEmployee(employee);
                                const assignments = await loadEmployeeAssignments(employee.id);
                                setEditForm({
                                  name: employee.name,
                                  employeeCode: employee.employeeCode || "",
                                  phone: employee.phone || "",
                                  regularDayOff: employee.regularDayOff || "",
                                  province: employee.province || "",
                                  region: employee.region || "",
                                  defaultStoreId: employee.defaultStoreId || "",
                                  selectedStoreIds: assignments.map((a: EmployeeStoreAssignment) => a.storeId),
                                  primaryStoreId: assignments.find((a: EmployeeStoreAssignment) => a.isPrimary)?.storeId || "",
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
                                handleDelete(employee.id, employee.name);
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
              {sortedEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className="rounded-2xl bg-white/80 backdrop-blur-xl border-2 border-white/60 shadow-lg p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center shadow-lg">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{employee.name}</p>
                      <p className="text-xs text-slate-500">{employee.employeeCode || "ไม่มีรหัส"}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {employee.phone && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 text-xs text-slate-600">
                        <Phone className="h-3 w-3" />
                        {employee.phone}
                      </span>
                    )}
                    {employee.province && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-xs text-blue-700">
                        <MapPin className="h-3 w-3" />
                        {employee.province}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons - Mobile */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setEditingEmployee(employee);
                        const assignments = await loadEmployeeAssignments(employee.id);
                        setEditForm({
                          name: employee.name,
                          employeeCode: employee.employeeCode || "",
                          phone: employee.phone || "",
                          regularDayOff: employee.regularDayOff || "",
                          province: employee.province || "",
                          region: employee.region || "",
                          defaultStoreId: employee.defaultStoreId || "",
                          selectedStoreIds: assignments.map((a: EmployeeStoreAssignment) => a.storeId),
                          primaryStoreId: assignments.find((a: EmployeeStoreAssignment) => a.isPrimary)?.storeId || "",
                        });
                        setIsEditModalOpen(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(employee.id, employee.name)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-200 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      ลบ
                    </button>
                  </div>

                  {/* Show Stores - Mobile */}
                  {(() => {
                    const assignments = allEmployeeAssignments.get(employee.id) || [];
                    const isExpanded = expandedStoreRows.has(employee.id);

                    if (assignments.length === 0) return null;

                    return (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-slate-500">ร้านค้า:</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStoreExpand(employee.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-xs font-medium text-blue-700 transition-colors"
                          >
                            <Building2 className="h-3 w-3" />
                            {assignments.length} ร้าน
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        </div>

                        {isExpanded ? (
                          <div className="space-y-1 animate-slide-in">
                            {assignments.map(a => (
                              <div
                                key={a.id}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                                  a.isPrimary
                                    ? 'bg-emerald-50 border border-emerald-200'
                                    : 'bg-slate-50'
                                }`}
                              >
                                {a.isPrimary ? (
                                  <span className="text-emerald-600 text-sm">★</span>
                                ) : (
                                  <span className="text-slate-300 text-sm">•</span>
                                )}
                                <span className={`text-xs font-medium flex-1 ${
                                  a.isPrimary ? 'text-emerald-700' : 'text-slate-700'
                                }`}>
                                  {a.storeName}
                                </span>
                                {a.isPrimary && (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                                    หลัก
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {assignments.slice(0, 2).map(a => (
                              <span
                                key={a.id}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                                  a.isPrimary
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {a.isPrimary && <span className="text-emerald-600">★</span>}
                                {a.storeName}
                              </span>
                            ))}
                            {assignments.length > 2 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-xs font-medium text-blue-600">
                                +{assignments.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ✏️ Edit Employee Modal */}
      {isEditModalOpen && editingEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => {
            setIsEditModalOpen(false);
            setEditingEmployee(null);
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
                    <h2 className="text-xl font-bold text-white">แก้ไขข้อมูลพนักงาน</h2>
                    <p className="text-sm text-blue-100 mt-1">{editingEmployee.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingEmployee(null);
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
                    ชื่อพนักงาน *
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="form-input w-full"
                    placeholder="ชื่อ-นามสกุล"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    รหัสพนักงาน
                  </label>
                  <input
                    type="text"
                    value={editForm.employeeCode}
                    onChange={(e) => setEditForm(prev => ({ ...prev, employeeCode: e.target.value }))}
                    className="form-input w-full"
                    placeholder="E001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="form-input w-full"
                    placeholder="081-234-5678"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    จังหวัด
                  </label>
                  <select
                    value={editForm.province}
                    onChange={(e) => handleProvinceChange(e.target.value, setEditForm)}
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
                    วันหยุดประจำ
                  </label>
                  <select
                    value={editForm.regularDayOff}
                    onChange={(e) => setEditForm(prev => ({ ...prev, regularDayOff: e.target.value }))}
                    className="form-input w-full"
                  >
                    {DAY_OFF_OPTIONS.map(day => (
                      <option key={day} value={day}>{day || "ไม่ระบุ"}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    ร้านหลัก (เลือกหลังจากเลือกร้านด้านล่าง)
                  </label>
                  <select
                    value={editForm.defaultStoreId}
                    onChange={(e) => setEditForm(prev => ({ ...prev, defaultStoreId: e.target.value }))}
                    className="form-input w-full"
                  >
                    <option value="">ไม่ระบุ</option>
                    {stores.map(store => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Store Selection with Primary */}
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-600 mb-3">
                  ร้านค้าที่รับผิดชอบ (เลือกได้หลายร้าน)
                </label>
                {stores.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-600">
                    ยังไม่มีร้านค้าในระบบ
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {stores.map(store => {
                      const isSelected = editForm.selectedStoreIds.includes(store.id);
                      const isPrimary = editForm.primaryStoreId === store.id;

                      return (
                        <div key={store.id} className="flex items-center gap-3 rounded-lg bg-white p-2 border border-slate-100">
                          <input
                            type="checkbox"
                            id={`edit-store-${store.id}`}
                            checked={isSelected}
                            onChange={() => toggleStoreSelection(store.id, setEditForm)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                          />
                          <label htmlFor={`edit-store-${store.id}`} className="flex-1 text-sm text-slate-700 cursor-pointer truncate">
                            {store.name}
                          </label>
                          {isSelected && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                id={`edit-primary-${store.id}`}
                                name="edit-primary-store"
                                checked={isPrimary}
                                onChange={() => setPrimaryStore(store.id, setEditForm)}
                                className="h-3.5 w-3.5 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                              />
                              <label htmlFor={`edit-primary-${store.id}`} className="text-xs font-medium text-emerald-600 cursor-pointer whitespace-nowrap">
                                หลัก
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 p-6 bg-slate-50">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingEmployee(null);
                    setEditForm(EMPTY_FORM);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => handleUpdate(editingEmployee.id)}
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

      {/* ➕ Add Employee Modal */}
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
                    <h2 className="text-xl font-bold text-white">เพิ่มพนักงานใหม่</h2>
                    <p className="text-sm text-blue-100 mt-1">กรอกข้อมูลพนักงาน</p>
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
                    ชื่อพนักงาน *
                  </label>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                    className="form-input w-full"
                    placeholder="ชื่อ-นามสกุล"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    รหัสพนักงาน
                  </label>
                  <input
                    type="text"
                    value={addForm.employeeCode}
                    onChange={(e) => setAddForm(prev => ({ ...prev, employeeCode: e.target.value }))}
                    className="form-input w-full"
                    placeholder="E001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="tel"
                    value={addForm.phone}
                    onChange={(e) => setAddForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="form-input w-full"
                    placeholder="081-234-5678"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    จังหวัด
                  </label>
                  <select
                    value={addForm.province}
                    onChange={(e) => handleProvinceChange(e.target.value, setAddForm)}
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
                    วันหยุดประจำ
                  </label>
                  <select
                    value={addForm.regularDayOff}
                    onChange={(e) => setAddForm(prev => ({ ...prev, regularDayOff: e.target.value }))}
                    className="form-input w-full"
                  >
                    {DAY_OFF_OPTIONS.map(day => (
                      <option key={day} value={day}>{day || "ไม่ระบุ"}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    ร้านหลัก (เลือกหลังจากเลือกร้านด้านล่าง)
                  </label>
                  <select
                    value={addForm.defaultStoreId}
                    onChange={(e) => setAddForm(prev => ({ ...prev, defaultStoreId: e.target.value }))}
                    className="form-input w-full"
                  >
                    <option value="">ไม่ระบุ</option>
                    {stores.map(store => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Store Selection with Primary */}
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-600 mb-3">
                  ร้านค้าที่รับผิดชอบ (เลือกได้หลายร้าน)
                </label>
                {stores.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-600">
                    ยังไม่มีร้านค้าในระบบ กรุณาเพิ่มร้านก่อน
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {stores.map(store => {
                      const isSelected = addForm.selectedStoreIds.includes(store.id);
                      const isPrimary = addForm.primaryStoreId === store.id;

                      return (
                        <div key={store.id} className="flex items-center gap-3 rounded-lg bg-white p-2 border border-slate-100">
                          <input
                            type="checkbox"
                            id={`add-store-${store.id}`}
                            checked={isSelected}
                            onChange={() => toggleStoreSelection(store.id, setAddForm)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                          />
                          <label htmlFor={`add-store-${store.id}`} className="flex-1 text-sm text-slate-700 cursor-pointer truncate">
                            {store.name} {store.province && <span className="text-slate-400">({store.province})</span>}
                          </label>
                          {isSelected && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                id={`add-primary-${store.id}`}
                                name="add-primary-store"
                                checked={isPrimary}
                                onChange={() => setPrimaryStore(store.id, setAddForm)}
                                className="h-3.5 w-3.5 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                              />
                              <label htmlFor={`add-primary-${store.id}`} className="text-xs font-medium text-emerald-600 cursor-pointer whitespace-nowrap">
                                หลัก
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  💡 เลือก checkbox ร้านที่ต้องการ แล้วเลือกวงกลม &ldquo;หลัก&rdquo; สำหรับร้านหลัก
                </p>
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
                  {isSaving ? "กำลังบันทึก..." : "✨ เพิ่มพนักงาน"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
