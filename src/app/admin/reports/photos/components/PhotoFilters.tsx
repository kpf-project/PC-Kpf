"use client";

import { useState } from "react";

export interface PhotoFiltersState {
  employeeId: string;
  startDate: string;
  endDate: string;
}

interface PhotoFiltersProps {
  employees: Array<{ id: string; name: string }>;
  initialFilters: PhotoFiltersState;
  onFilterChange: (filters: PhotoFiltersState) => void;
  isLoading?: boolean;
}

export default function PhotoFilters({
  employees,
  initialFilters,
  onFilterChange,
  isLoading = false,
}: PhotoFiltersProps) {
  const [filters, setFilters] = useState<PhotoFiltersState>(initialFilters);

  const getCurrentMonthRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  };

  const handleEmployeeChange = (employeeId: string) => {
    const newFilters = { ...filters, employeeId };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleStartDateChange = (startDate: string) => {
    const newFilters = { ...filters, startDate };
    setFilters(newFilters);
  };

  const handleEndDateChange = (endDate: string) => {
    const newFilters = { ...filters, endDate };
    setFilters(newFilters);
  };

  const handleApplyDateRange = () => {
    onFilterChange(filters);
  };

  const handleCurrentMonth = () => {
    const range = getCurrentMonthRange();
    const newFilters = {
      ...filters,
      startDate: range.start,
      endDate: range.end,
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleLastMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const newFilters = {
      ...filters,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const datesChanged =
    filters.startDate !== initialFilters.startDate ||
    filters.endDate !== initialFilters.endDate;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-blue-200/50 p-6 print:hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-blue-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-blue-900">ตัวกรองข้อมูล</h2>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-blue-600">
            <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="text-sm font-medium">กำลังโหลด...</span>
          </div>
        )}
      </div>

      {/* Filter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {/* Employee Select */}
        <div className="group">
          <label htmlFor="employee" className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            พนักงาน <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <select
              id="employee"
              value={filters.employeeId}
              onChange={(e) => handleEmployeeChange(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-3 text-sm border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed bg-white text-blue-900 font-medium shadow-sm hover:border-blue-300 transition-colors appearance-none"
            >
              <option value="">เลือกพนักงาน</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Start Date */}
        <div className="group">
          <label htmlFor="startDate" className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            วันที่เริ่มต้น <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            id="startDate"
            value={filters.startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-3 text-sm border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed bg-white text-blue-900 font-medium shadow-sm hover:border-blue-300 transition-colors"
          />
        </div>

        {/* End Date */}
        <div className="group">
          <label htmlFor="endDate" className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            วันที่สิ้นสุด <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            id="endDate"
            value={filters.endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-3 text-sm border-2 border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed bg-white text-blue-900 font-medium shadow-sm hover:border-blue-300 transition-colors"
          />
        </div>

      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-blue-100">
        <div className="flex items-center gap-2 text-sm font-bold text-blue-900">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          ช่วงเวลา:
        </div>
        <button
          onClick={handleCurrentMonth}
          disabled={isLoading}
          className="group px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          เดือนนี้
        </button>
        <button
          onClick={handleLastMonth}
          disabled={isLoading}
          className="group px-5 py-2.5 text-sm font-bold bg-white hover:bg-blue-50 text-blue-700 border-2 border-blue-200 hover:border-blue-300 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          เดือนที่แล้ว
        </button>

        {datesChanged && (
          <button
            onClick={handleApplyDateRange}
            disabled={isLoading}
            className="group ml-auto px-6 py-2.5 text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            ใช้งาน
          </button>
        )}
      </div>
    </div>
  );
}
