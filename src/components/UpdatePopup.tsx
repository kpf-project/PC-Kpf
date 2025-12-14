'use client';

/**
 * PWA Update Popup Component
 * Simple, professional, and reusable update notification
 */

import { useEffect, useState } from 'react';
import { serviceWorkerManager } from '@/lib/serviceWorkerManager';
import { RefreshCw } from 'lucide-react';

export function UpdatePopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [version, setVersion] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    console.log('[UpdatePopup] 🎨 Component mounted');

    // Initialize service worker and listen for updates
    const handleUpdate = (newVersion: string) => {
      console.log('[UpdatePopup] 🔔 Update detected! Version:', newVersion);
      setVersion(newVersion);
      setIsVisible(true);
    };

    serviceWorkerManager.initialize(handleUpdate);

    return () => {
      console.log('[UpdatePopup] 🗑️ Component unmounting');
      serviceWorkerManager.cleanup();
    };
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);

    // Add slight delay for better UX
    setTimeout(() => {
      serviceWorkerManager.applyUpdate();
    }, 500);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleDismiss}
      />

      {/* Popup Container - Simple & Professional */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div
          data-update-popup="true"
          data-version={version}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Content - Clean and Minimal */}
          <div className="px-8 py-6">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                <RefreshCw className="h-7 w-7 text-blue-600" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
              มีเวอร์ชันใหม่พร้อมใช้งาน
            </h2>

            {/* Version Badge */}
            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold border border-blue-200">
                เวอร์ชัน {version}
              </span>
            </div>

            {/* Description - Generic message that works for all updates */}
            <p className="text-sm text-slate-600 text-center leading-relaxed mb-6">
              กรุณาอัปเดตเพื่อรับฟีเจอร์ใหม่ การแก้ไขบั๊ก<br />
              และการปรับปรุงประสิทธิภาพของระบบ
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 px-5 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 active:scale-98 transition-all"
              >
                ภายหลัง
              </button>

              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="flex-1 px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 active:scale-98 transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังอัปเดต...</span>
                  </>
                ) : (
                  <span>อัปเดตเลย</span>
                )}
              </button>
            </div>
          </div>

          {/* Footer Note - Optional professional touch */}
          <div className="px-8 py-3 bg-slate-50 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center">
              การอัปเดตจะใช้เวลาเพียงไม่กี่วินาที
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
