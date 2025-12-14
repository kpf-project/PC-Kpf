'use client';

/**
 * Login Page
 * PIN-based authentication for role-based access
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import PINKeypad from '@/components/PINKeypad';
import { Lock } from 'lucide-react';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const handlePinSubmit = async (pin: string) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await login(pin);

      if (!result.success) {
        setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
        setIsSubmitting(false);
      }
      // ✅ Success - redirect will happen automatically via useEffect (line 21-25)
      // No need to call router.replace() here to avoid double redirect
    } catch (err) {
      console.error('[Login] error:', err);
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      setIsSubmitting(false);
    }
  };

  const handleClearError = () => {
    setError(null);
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
          <p className="text-sm text-slate-600">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-3xl bg-white/97 p-8 shadow-[0_20px_80px_-15px_rgba(0,0,0,0.12)] border border-white/50 lg:backdrop-blur-sm">
          {/* Logo/Header */}
          <div className="mb-12 text-center">
            <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_10px_40px_-10px_rgba(59,130,246,0.4)]">
              <Lock className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-900 to-indigo-900 bg-clip-text text-transparent">เข้าสู่ระบบ</h1>
          </div>

          {/* PIN Keypad */}
          <PINKeypad
            minLength={4}
            maxLength={6}
            onSubmit={handlePinSubmit}
            isLoading={isSubmitting}
            error={error}
            onClear={handleClearError}
          />
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-500">
          © 2025 Attendance Tracker
        </p>
      </div>
    </div>
  );
}
