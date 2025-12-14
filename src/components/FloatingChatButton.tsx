'use client';

/**
 * FloatingChatButton Component
 *
 * Facebook Messenger-style floating chat
 * - Desktop: Expandable chat box (bottom-right like Facebook)
 * - Mobile: Full screen modal
 */

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Minus } from 'lucide-react';
import { SupportChatModal } from './SupportChatModal';
import { useModal } from '@/contexts/ModalContext';

export function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const pathname = usePathname();
  const { openModal, closeModal } = useModal();

  // Sync modal state with context
  useEffect(() => {
    const MODAL_ID = 'floating-chat';
    if (isOpen && !isMinimized) {
      openModal(MODAL_ID);
      return () => {
        // Cleanup: close when unmounting or chat closes
        closeModal(MODAL_ID);
      };
    }
  }, [isOpen, isMinimized, openModal, closeModal]);

  // Hide on login page
  if (pathname === '/login') {
    return null;
  }

  // Adjust mobile position for sales page (has bottom submit bar)
  const isSalesPage = pathname === '/sales';
  const mobileBottomOffset = isSalesPage
    ? "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" // 88px (~80px bar + 8px spacing)
    : "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)"; // 24px default

  return (
    <>
      {/* Desktop: Messenger-style chat box (hidden on mobile) */}
      <div className="fixed bottom-0 right-0 z-[999] hidden md:block print:hidden">
        {isOpen && !isMinimized ? (
          /* Expanded Chat Box */
          <div className="mb-0 w-[400px] rounded-tl-2xl bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border-l border-t border-slate-200/80 overflow-hidden backdrop-blur-sm">
            {/* Header Bar */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white/20 p-1.5 backdrop-blur-sm">
                  <MessageCircle className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <span className="font-semibold text-white text-sm tracking-tight">Support Center</span>
                  <p className="text-xs text-white/80 font-medium">We&apos;re here to help</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="rounded-lg p-2 text-white/70 transition hover:bg-white/15 hover:text-white active:scale-95"
                  aria-label="Minimize"
                >
                  <Minus className="h-4 w-4" strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-2 text-white/70 transition hover:bg-white/15 hover:text-white active:scale-95"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Chat Content */}
            <div className="h-[540px] overflow-y-auto bg-gradient-to-b from-slate-50/50 to-white">
              <SupportChatModal onClose={() => setIsOpen(false)} isDesktop />
            </div>
          </div>
        ) : isOpen && isMinimized ? (
          /* Minimized Tab */
          <div className="flex items-center gap-2 rounded-tl-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-white shadow-2xl border-l border-t border-white/10">
            <button
              onClick={() => setIsMinimized(false)}
              className="flex flex-1 items-center gap-2.5 transition hover:opacity-95"
              aria-label="Expand chat"
            >
              <div className="rounded-lg bg-white/20 p-1 backdrop-blur-sm">
                <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
              </div>
              <span className="text-sm font-semibold tracking-tight">Support Center</span>
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                setIsMinimized(false);
              }}
              className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/15 hover:text-white active:scale-95"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          /* Closed Button */
          <div className="m-4">
            <button
              onClick={() => {
                setIsOpen(true);
                setIsMinimized(false);
              }}
              className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white shadow-[0_10px_40px_-10px_rgba(37,99,235,0.6)] transition-all hover:shadow-[0_20px_60px_-15px_rgba(37,99,235,0.8)] hover:scale-110 active:scale-95"
              aria-label="Open support chat"
            >
              <MessageCircle className="h-7 w-7 transition-transform group-hover:scale-110" strokeWidth={2.5} />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile: Full screen modal (hidden on desktop) */}
      <div
        className="fixed z-[999] md:hidden print:hidden"
        style={{
          bottom: mobileBottomOffset,
          left: isSalesPage ? "1.5rem" : undefined,
          right: isSalesPage ? undefined : "1.5rem",
        }}
      >
        {isOpen ? (
          <SupportChatModal onClose={() => setIsOpen(false)} isDesktop={false} />
        ) : (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white shadow-[0_8px_30px_-8px_rgba(37,99,235,0.5)] transition-all active:scale-90 hover:shadow-[0_12px_40px_-10px_rgba(37,99,235,0.7)]"
            aria-label="Open support"
          >
            <MessageCircle className="h-6 w-6 transition-transform group-active:scale-90" strokeWidth={2.5} />
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
            </span>
          </button>
        )}
      </div>
    </>
  );
}
