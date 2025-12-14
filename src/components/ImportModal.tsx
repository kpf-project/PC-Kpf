"use client";

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from "react";
import { Upload, X, Download, FileText, CheckCircle, AlertCircle } from "lucide-react";
import clsx from "clsx";

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<void>;
  title: string;
  acceptedFormats: string;
  templateDownloadUrl?: string;
}

export default function ImportModal({
  isOpen,
  onClose,
  onImport,
  title,
  acceptedFormats,
  templateDownloadUrl,
}: ImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    setSuccess(null);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    if (isImporting) return;
    resetState();
    onClose();
  }, [isImporting, resetState, onClose]);

  const validateFile = useCallback((file: File): boolean => {
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

    if (!validExtensions.includes(fileExtension)) {
      setError(`ไฟล์ต้องเป็นนามสกุล ${validExtensions.join(", ")} เท่านั้น`);
      return false;
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("ไฟล์มีขนาดใหญ่เกิน 10MB");
      return false;
    }

    return true;
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => {
      setError(null);
      setSuccess(null);

      if (validateFile(file)) {
        setSelectedFile(file);
      }
    },
    [validateFile]
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);

      const file = event.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleImportClick = useCallback(async () => {
    if (!selectedFile || isImporting) return;

    setIsImporting(true);
    setError(null);
    setSuccess(null);

    try {
      await onImport(selectedFile);
      setSuccess("นำเข้าข้อมูลสำเร็จ");

      // Close modal after 1.5 seconds
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการนำเข้าข้อมูล";
      setError(errorMessage);
    } finally {
      setIsImporting(false);
    }
  }, [selectedFile, isImporting, onImport, handleClose]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">
                รองรับไฟล์: {acceptedFormats}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isImporting}
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="ปิด"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-6 px-6 py-6">
            {/* Template Download Button */}
            {templateDownloadUrl && (
              <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                    <Download className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      ดาวน์โหลด Template
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      ดาวน์โหลดไฟล์ตัวอย่างเพื่อดูรูปแบบที่ถูกต้องก่อนนำเข้าข้อมูล
                    </p>
                    <a
                      href={templateDownloadUrl}
                      download
                      className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-sky-600 transition hover:text-sky-700"
                    >
                      <Download className="h-4 w-4" />
                      ดาวน์โหลดไฟล์ตัวอย่าง
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* File Upload Area */}
            <div>
              <label className="text-sm font-medium text-slate-700">
                เลือกไฟล์สำหรับนำเข้า
              </label>
              <div
                className={clsx(
                  "mt-2 rounded-2xl border-2 border-dashed p-8 text-center transition",
                  isDragging
                    ? "border-sky-400 bg-sky-50"
                    : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {selectedFile ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                        <FileText className="h-8 w-8" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetState}
                      disabled={isImporting}
                      className="text-sm font-medium text-slate-600 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      เลือกไฟล์อื่น
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Upload className="h-8 w-8" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        รองรับไฟล์ {acceptedFormats} ขนาดไม่เกิน 10MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleBrowseClick}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Upload className="h-4 w-4" />
                      เลือกไฟล์
                    </button>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                <p className="text-sm text-emerald-700">{success}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isImporting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              disabled={!selectedFile || isImporting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:from-sky-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isImporting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  กำลังนำเข้า...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  นำเข้าข้อมูล
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
