'use client';

/**
 * Authentication Context
 * Manages user authentication state and provides auth methods
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthContextState, AuthUser, UserRole } from '@/types/auth';
import { hasRequiredRole } from '@/types/auth';

const AuthContext = createContext<AuthContextState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verify session on mount
  useEffect(() => {
    void verifySession();
  }, []);

  /**
   * Verify current session
   */
  const verifySession = async () => {
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = await response.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('[AuthContext] verify error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login with PIN
   */
  const login = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'เกิดข้อผิดพลาด',
        };
      }

      // Update auth state
      setUser(data.user);

      return { success: true };
    } catch (error) {
      console.error('[AuthContext] login error:', error);
      return {
        success: false,
        error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ',
      };
    }
  };

  /**
   * Logout
   */
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      setUser(null);

      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('[AuthContext] logout error:', error);
      // Clear user state anyway
      setUser(null);

      // Redirect even if API call fails
      window.location.href = '/login';
    }
  };

  /**
   * Check if user has required role
   */
  const hasRole = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    return hasRequiredRole(user.role, requiredRole);
  };

  const value: AuthContextState = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextState {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
