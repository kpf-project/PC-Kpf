'use client';

/**
 * SupportChatModal Component
 *
 * Modal for submitting support tickets/feedback
 * Automatically captures user context
 */

import { useState, useEffect } from 'react';
import { X, Send, Bug, Lightbulb, HelpCircle, Loader2, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type SupportType = 'bug' | 'suggestion' | 'question';

interface SupportChatModalProps {
  onClose: () => void;
  isDesktop?: boolean;
}

export function SupportChatModal({ onClose, isDesktop = false }: SupportChatModalProps) {
  const { user } = useAuth();
  const [type, setType] = useState<SupportType>('bug');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Auto-captured context
  const [context, setContext] = useState({
    url: '',
    userAgent: '',
    timestamp: '',
  });

  useEffect(() => {
    setContext({
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      setError('กรุณากรอกข้อความ');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/support/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message: message.trim(),
          user: {
            name: user?.employeeName || 'ไม่ระบุชื่อ',
            id: user?.employeeId || null,
            role: user?.role || 'unknown',
          },
          context,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      setSuccess(true);
      setMessage('');

      // Close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('[SupportChat] Error:', err);
      setError(err instanceof Error ? err.message : 'ไม่สามารถส่งข้อความได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeOptions = [
    {
      value: 'bug',
      label: 'Report Issue',
      labelTh: 'แจ้งปัญหา',
      icon: Bug,
      color: 'text-rose-700 bg-gradient-to-br from-rose-50 to-red-50 border-rose-300 shadow-sm shadow-rose-100',
      activeColor: 'text-rose-700 bg-gradient-to-br from-rose-100 to-red-100 border-rose-400 shadow-md shadow-rose-200'
    },
    {
      value: 'suggestion',
      label: 'Suggestion',
      labelTh: 'เสนอแนะ',
      icon: Lightbulb,
      color: 'text-amber-700 bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300 shadow-sm shadow-amber-100',
      activeColor: 'text-amber-700 bg-gradient-to-br from-amber-100 to-yellow-100 border-amber-400 shadow-md shadow-amber-200'
    },
    {
      value: 'question',
      label: 'Question',
      labelTh: 'สอบถาม',
      icon: HelpCircle,
      color: 'text-blue-700 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-sm shadow-blue-100',
      activeColor: 'text-blue-700 bg-gradient-to-br from-blue-100 to-indigo-100 border-blue-400 shadow-md shadow-blue-200'
    },
  ] as const;

  // Desktop mode: no overlay, just content
  if (isDesktop) {
    return (
      <div className="bg-white">
        {/* No header needed - already in FloatingChatButton */}

        {/* Success Message */}
        {success && (
          <div className="mx-5 mt-5 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 text-center shadow-lg">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 mb-3 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-bold text-emerald-900 mb-1">Message Sent!</p>
            <p className="text-sm text-emerald-700 font-medium">Our team will respond shortly</p>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Type Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-3 tracking-wide uppercase">
                Select Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map(({ value, label, labelTh, icon: Icon, color, activeColor }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all duration-200 ${
                      type === value
                        ? activeColor
                        : `${color} hover:scale-105 active:scale-95`
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.5} />
                    <div className="text-center">
                      <span className="block text-[10px] font-bold tracking-tight">{label}</span>
                      <span className="block text-[9px] opacity-75">{labelTh}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="support-message-desktop" className="block text-xs font-bold text-slate-700 mb-2 tracking-wide uppercase">
                Your Message
              </label>
              <textarea
                id="support-message-desktop"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue or feedback in detail..."
                rows={6}
                className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                required
              />
              <p className="text-[10px] text-slate-500 mt-1.5 font-medium">{message.length} characters</p>
            </div>

            {/* User Info Display */}
            <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/50 p-3 shadow-sm">
              <p className="text-[10px] font-bold text-slate-600 mb-2 tracking-wide uppercase flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                Your Information
              </p>
              <div className="space-y-1 text-xs text-slate-700 font-medium">
                <p className="flex items-center gap-2">
                  <span className="text-slate-500">Name:</span>
                  <span className="font-semibold">{user?.employeeName || 'Anonymous'}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-slate-500">Role:</span>
                  <span className="font-semibold capitalize">{user?.role || 'user'}</span>
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-rose-50 p-3 text-xs text-red-800 font-semibold shadow-sm">
                ⚠️ {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" strokeWidth={2.5} />
                  <span>Send Message</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    );
  }

  // Mobile mode: full screen with overlay
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-white shadow-2xl animate-slide-up border-t-4 border-blue-500"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/30 border-b-2 border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 shadow-lg">
              <MessageCircle className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Support Center</h2>
              <p className="text-xs text-slate-600 font-medium mt-0.5">How can we assist you?</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-all active:scale-90"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mx-6 mt-6 mb-6 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 text-center shadow-lg">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 mb-4 shadow-xl">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xl font-bold text-emerald-900 mb-2">Message Sent!</p>
            <p className="text-sm text-emerald-700 font-medium">Our team will respond shortly</p>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Type Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-3 tracking-wide uppercase">
                Select Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {typeOptions.map(({ value, label, labelTh, icon: Icon, color, activeColor }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 ${
                      type === value
                        ? activeColor
                        : `${color} hover:scale-105 active:scale-95`
                    }`}
                  >
                    <Icon className="h-6 w-6" strokeWidth={2.5} />
                    <div className="text-center">
                      <span className="block text-xs font-bold tracking-tight">{label}</span>
                      <span className="block text-[10px] opacity-75 mt-0.5">{labelTh}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="support-message" className="block text-xs font-bold text-slate-700 mb-2 tracking-wide uppercase">
                Your Message
              </label>
              <textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue or feedback in detail..."
                rows={6}
                className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                required
              />
              <p className="text-[10px] text-slate-500 mt-2 font-medium">{message.length} characters</p>
            </div>

            {/* User Info Display */}
            <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/50 p-4 shadow-sm">
              <p className="text-[10px] font-bold text-slate-600 mb-2 tracking-wide uppercase flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                Your Information
              </p>
              <div className="space-y-1.5 text-xs text-slate-700 font-medium">
                <p className="flex items-center gap-2">
                  <span className="text-slate-500 font-semibold">Name:</span>
                  <span className="font-bold">{user?.employeeName || 'Anonymous'}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-slate-500 font-semibold">Role:</span>
                  <span className="font-bold capitalize">{user?.role || 'user'}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-slate-500 font-semibold">Page:</span>
                  <span className="font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded">{context.url.split('/').pop() || '/'}</span>
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-rose-50 p-4 text-sm text-red-800 font-semibold shadow-sm">
                ⚠️ {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-6 py-4 text-base font-bold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.5} />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" strokeWidth={2.5} />
                  <span>Send Message</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
