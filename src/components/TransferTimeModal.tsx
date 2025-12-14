"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import CameraCapture from "./CameraCapture";

interface TransferData {
  oldStore: string;
  newStore: string;
  checkInTime: string;
  checkInDate: string;
}

interface TransferInfo {
  checkOutTime: string;
  checkOutPhoto: string;
  checkInTime: string;
  checkInPhoto: string;
}

interface TransferTimeModalProps {
  isOpen: boolean;
  transferData: TransferData;
  onConfirm: (info: TransferInfo) => Promise<void>;
  onSkip: () => void;
  onClose: () => void;
}

export default function TransferTimeModal({
  isOpen,
  transferData,
  onConfirm,
  onSkip,
  onClose,
}: TransferTimeModalProps) {
  const [checkOutTime, setCheckOutTime] = useState("");
  const [checkOutPhoto, setCheckOutPhoto] = useState<string | null>(null);
  const [checkInTime, setCheckInTime] = useState("");
  const [checkInPhoto, setCheckInPhoto] = useState<string | null>(null);

  const [showCameraFor, setShowCameraFor] = useState<
    "checkOut" | "checkIn" | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCheckOutTime("");
      setCheckOutPhoto(null);
      setCheckInTime("");
      setCheckInPhoto(null);
      setShowCameraFor(null);
      setIsSubmitting(false);
      setError(null);
    }
  }, [isOpen]);

  // Validation
  const validateTimes = useCallback((): string | null => {
    if (!checkOutTime) {
      return "กรุณากรอกเวลาออกจากร้านเดิม";
    }

    if (!checkInTime) {
      return "กรุณากรอกเวลาเข้าร้านใหม่";
    }

    // Check if check-out time is after check-in time
    if (checkOutTime <= transferData.checkInTime) {
      return `เวลาออกต้องมากกว่าเวลาเข้า (${transferData.checkInTime})`;
    }

    // Check if check-in to new store is after check-out from old store
    if (checkInTime <= checkOutTime) {
      return "เวลาเข้าร้านใหม่ต้องมากกว่าเวลาออกจากร้านเดิม";
    }

    return null;
  }, [checkOutTime, checkInTime, transferData.checkInTime]);

  // Handle camera capture
  const handleCameraCapture = useCallback(
    (type: "checkOut" | "checkIn", photo: string) => {
      if (type === "checkOut") {
        setCheckOutPhoto(photo);
      } else {
        setCheckInPhoto(photo);
      }
      setShowCameraFor(null);
    },
    []
  );

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    // Validate
    const validationError = validateTimes();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!checkOutPhoto || !checkInPhoto) {
      setError("กรุณาถ่ายรูปให้ครบทั้ง 2 รูป");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm({
        checkOutTime,
        checkOutPhoto,
        checkInTime,
        checkInPhoto,
      });
    } catch (err) {
      console.error("[TransferTimeModal] submit error:", err);
      setError(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง"
      );
      setIsSubmitting(false);
    }
  }, [
    validateTimes,
    checkOutPhoto,
    checkInPhoto,
    checkOutTime,
    checkInTime,
    onConfirm,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen || showCameraFor) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isOpen, showCameraFor, onClose]);

  if (!isOpen) return null;

  // Show camera
  if (showCameraFor) {
    const overlayText =
      showCameraFor === "checkOut"
        ? `${checkOutTime} น.\nออกจาก ${transferData.oldStore}`
        : `${checkInTime} น.\nเข้า ${transferData.newStore}`;

    return (
      <CameraCapture
        overlayText={overlayText}
        onCapture={(photo) => handleCameraCapture(showCameraFor, photo)}
        onCancel={() => setShowCameraFor(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-5 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  เปลี่ยนร้านใช่ไหม?
                </h2>
                <p className="text-sm text-white/80">
                  ระบบตรวจพบการเปลี่ยนสถานที่ทำงาน
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors flex items-center justify-center"
            >
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Transfer info */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <span className="font-bold text-gray-900">
                  {transferData.oldStore}
                </span>
              </div>
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <span className="font-bold text-gray-900">
                  {transferData.newStore}
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">เวลาเข้างานที่ {transferData.oldStore}:</span>{" "}
              <span className="font-mono font-bold text-blue-600">
                {transferData.checkInTime} น.
              </span>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3 animate-in slide-in-from-top duration-300">
              <svg
                className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="font-semibold text-red-900 text-sm">ข้อผิดพลาด</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-6">
            {/* Section 1: Check-out from old store */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold">1</span>
                </div>
                <h3 className="font-bold text-gray-900">
                  เวลาออกจาก {transferData.oldStore}
                </h3>
              </div>

              {/* Time input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เวลา <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={checkOutTime.split(':')[0] || ''}
                    onChange={(e) => {
                      const hour = e.target.value;
                      const minute = checkOutTime.split(':')[1] || '00';
                      setCheckOutTime(`${hour}:${minute}`);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none text-lg"
                    required
                  >
                    <option value="">-- ชั่วโมง --</option>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return (
                        <option key={i} value={hour}>
                          {hour}
                        </option>
                      );
                    })}
                  </select>
                  <span className="flex items-center text-xl font-bold">:</span>
                  <select
                    value={checkOutTime.split(':')[1] || ''}
                    onChange={(e) => {
                      const hour = checkOutTime.split(':')[0] || '00';
                      const minute = e.target.value;
                      setCheckOutTime(`${hour}:${minute}`);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none text-lg"
                    required
                  >
                    <option value="">-- นาที --</option>
                    {Array.from({ length: 60 }, (_, i) => {
                      const minute = i.toString().padStart(2, '0');
                      return (
                        <option key={i} value={minute}>
                          {minute}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Photo input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  รูปถ่าย <span className="text-red-500">*</span>
                </label>

                {!checkOutPhoto ? (
                  <button
                    onClick={() => setShowCameraFor("checkOut")}
                    disabled={!checkOutTime || isSubmitting}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:from-gray-300 disabled:to-gray-300 text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
                  >
                    <svg
                      className="w-6 h-6 group-hover:scale-110 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>ถ่ายรูปออกจากร้าน</span>
                  </button>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-blue-200 shadow-lg">
                    <Image
                      src={checkOutPhoto}
                      alt="Check-out preview"
                      width={0}
                      height={0}
                      sizes="100vw"
                      className="w-full h-auto"
                    />
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={() => setCheckOutPhoto(null)}
                        className="px-4 py-2 bg-white/90 hover:bg-white rounded-xl font-semibold text-sm shadow-lg backdrop-blur-sm transition-all"
                      >
                        ถ่ายใหม่
                      </button>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 bg-green-600/90 backdrop-blur-sm rounded-xl px-4 py-2">
                      <p className="text-white font-semibold text-sm flex items-center gap-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        รูปถ่ายสำเร็จ
                      </p>
                    </div>
                  </div>
                )}

                {!checkOutTime && (
                  <p className="text-sm text-gray-500 mt-2">
                    💡 กรุณากรอกเวลาก่อนถ่ายรูป
                  </p>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-sm text-gray-500">
                  จากนั้น
                </span>
              </div>
            </div>

            {/* Section 2: Check-in to new store */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
                  <span className="text-cyan-600 font-bold">2</span>
                </div>
                <h3 className="font-bold text-gray-900">
                  เวลาเข้า {transferData.newStore}
                </h3>
              </div>

              {/* Time input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เวลา <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={checkInTime.split(':')[0] || ''}
                    onChange={(e) => {
                      const hour = e.target.value;
                      const minute = checkInTime.split(':')[1] || '00';
                      setCheckInTime(`${hour}:${minute}`);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 transition-all outline-none text-lg"
                    required
                  >
                    <option value="">-- ชั่วโมง --</option>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return (
                        <option key={i} value={hour}>
                          {hour}
                        </option>
                      );
                    })}
                  </select>
                  <span className="flex items-center text-xl font-bold">:</span>
                  <select
                    value={checkInTime.split(':')[1] || ''}
                    onChange={(e) => {
                      const hour = checkInTime.split(':')[0] || '00';
                      const minute = e.target.value;
                      setCheckInTime(`${hour}:${minute}`);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 transition-all outline-none text-lg"
                    required
                  >
                    <option value="">-- นาที --</option>
                    {Array.from({ length: 60 }, (_, i) => {
                      const minute = i.toString().padStart(2, '0');
                      return (
                        <option key={i} value={minute}>
                          {minute}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Photo input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  รูปถ่าย <span className="text-red-500">*</span>
                </label>

                {!checkInPhoto ? (
                  <button
                    onClick={() => setShowCameraFor("checkIn")}
                    disabled={!checkInTime || isSubmitting}
                    className="w-full px-6 py-4 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 disabled:from-gray-300 disabled:to-gray-300 text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
                  >
                    <svg
                      className="w-6 h-6 group-hover:scale-110 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>ถ่ายรูปเข้าร้านใหม่</span>
                  </button>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-cyan-200 shadow-lg">
                    <Image
                      src={checkInPhoto}
                      alt="Check-in preview"
                      width={0}
                      height={0}
                      sizes="100vw"
                      className="w-full h-auto"
                    />
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={() => setCheckInPhoto(null)}
                        className="px-4 py-2 bg-white/90 hover:bg-white rounded-xl font-semibold text-sm shadow-lg backdrop-blur-sm transition-all"
                      >
                        ถ่ายใหม่
                      </button>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 bg-green-600/90 backdrop-blur-sm rounded-xl px-4 py-2">
                      <p className="text-white font-semibold text-sm flex items-center gap-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        รูปถ่ายสำเร็จ
                      </p>
                    </div>
                  </div>
                )}

                {!checkInTime && (
                  <p className="text-sm text-gray-500 mt-2">
                    💡 กรุณากรอกเวลาก่อนถ่ายรูป
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-2">
                  ระบบจะบันทึก 4 รายการให้อัตโนมัติ:
                </p>
                <ol className="space-y-1 list-decimal list-inside text-blue-800">
                  <li>
                    {transferData.checkInTime} น. เข้างาน {transferData.oldStore}{" "}
                    <span className="text-green-600 font-semibold">(มีอยู่แล้ว)</span>
                  </li>
                  <li>
                    {checkOutTime || "??:??"} น. ออกงาน {transferData.oldStore}{" "}
                    <span className="text-blue-600 font-semibold">(ใหม่ 🤖)</span>
                  </li>
                  <li>
                    {checkInTime || "??:??"} น. เข้างาน {transferData.newStore}{" "}
                    <span className="text-blue-600 font-semibold">(ใหม่ 🤖)</span>
                  </li>
                  <li>
                    เวลาปัจจุบัน ออกงาน {transferData.newStore}{" "}
                    <span className="text-orange-600 font-semibold">(รายการที่กำลังบันทึก)</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t-2 border-gray-200 px-6 py-4 rounded-b-3xl">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onSkip}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 rounded-2xl font-semibold transition-all disabled:cursor-not-allowed"
            >
              ข้าม (บันทึกแค่ครั้งนี้)
            </button>
            <button
              onClick={handleConfirm}
              disabled={
                !checkOutTime ||
                !checkOutPhoto ||
                !checkInTime ||
                !checkInPhoto ||
                isSubmitting
              }
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-300 disabled:to-gray-300 text-white rounded-2xl font-semibold transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>ยืนยัน (สร้าง 4 รายการ)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
