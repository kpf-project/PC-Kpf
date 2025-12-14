'use client';

/**
 * Notification Popup Component
 *
 * Beautiful, animated notification for success/error messages
 * - Auto-dismiss after 4 seconds
 * - Smooth animations
 * - Success (blue/cyan gradient) and Error (red) variants
 * - Backdrop blur effect
 */

import { useEffect } from 'react';
import { BadgeCheck, OctagonAlert, AlertTriangle, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning';

interface NotificationPopupProps {
  isOpen: boolean;
  type: NotificationType;
  title: string;
  message?: string;
  onClose: () => void;
  autoDismiss?: boolean;
  autoDismissDelay?: number; // milliseconds
}

export default function NotificationPopup({
  isOpen,
  type,
  title,
  message,
  onClose,
  autoDismiss = true,
  autoDismissDelay = 4000,
}: NotificationPopupProps) {
  // Auto-dismiss after delay
  useEffect(() => {
    if (isOpen && autoDismiss) {
      const timer = setTimeout(() => {
        onClose();
      }, autoDismissDelay);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoDismiss, autoDismissDelay, onClose]);

  if (!isOpen) return null;

  // Determine colors and icon based on type
  const config = {
    success: {
      gradient: 'from-blue-600 to-cyan-400',
      bgGradient: 'from-blue-50 to-cyan-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-900',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      Icon: BadgeCheck,
    },
    error: {
      gradient: 'from-red-500 to-rose-500',
      bgGradient: 'from-red-50 to-rose-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-900',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      Icon: OctagonAlert,
    },
    warning: {
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-50 to-orange-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-900',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      Icon: AlertTriangle,
    },
  };

  const { gradient, textColor, iconBg, iconColor, Icon } = config[type];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Notification Card */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border-2 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 pointer-events-auto"
          style={{
            borderColor: `var(--${type}-200)`,
          }}
        >
          {/* Gradient Header */}
          <div className={`h-2 bg-gradient-to-r ${gradient}`} />

          {/* Content */}
          <div className="p-6">
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`flex-shrink-0 w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center`}>
                <Icon className={`h-7 w-7 ${iconColor}`} />
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0">
                <h3 className={`text-lg font-bold ${textColor} mb-1 leading-tight`}>
                  {title}
                </h3>
                {message && (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {message}
                  </p>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Progress Bar (Auto-dismiss indicator) */}
          {autoDismiss && (
            <div className="h-1 bg-slate-100 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${gradient} animate-[shrink_${autoDismissDelay}ms_linear]`}
                style={{
                  animation: `shrink ${autoDismissDelay}ms linear`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </>
  );
}
