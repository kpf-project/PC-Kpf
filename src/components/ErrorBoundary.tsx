'use client';

/**
 * ErrorBoundary Component
 *
 * Catches React errors and displays fallback UI
 * Prevents white screen of death
 */

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error to console
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // TODO: Send to error tracking service (Sentry, etc.)
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Render custom fallback UI or default error UI
      return this.props.fallback || (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-xl max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-red-900 mb-2">เกิดข้อผิดพลาด</h2>
              <p className="text-slate-600">
                ระบบพบข้อผิดพลาดที่ไม่คาดคิด กรุณารีเฟรชหน้าเพื่อลองใหม่
              </p>
            </div>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-xs font-mono text-red-800 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 transition"
              >
                รีเฟรชหน้า
              </button>

              <button
                onClick={() => window.location.href = '/'}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                กลับหน้าหลัก
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
