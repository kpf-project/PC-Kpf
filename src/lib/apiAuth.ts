/**
 * API Authentication Helpers
 *
 * Helper functions for verifying sessions and roles in API routes
 * Reduces boilerplate code and ensures consistent security checks
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySession } from './authSessions';
import type { UserRole } from '@/types/auth';
import type { SessionData } from './authSessions';

/**
 * Verify that user is authenticated
 * Returns session data if valid, or error response if not
 */
export async function requireAuth(): Promise<
  { success: true; session: SessionData } | { success: false; response: NextResponse }
> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  if (!sessionToken) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
        { status: 401 }
      ),
    };
  }

  const session = await verifySession(sessionToken);
  if (!session) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' },
        { status: 401 }
      ),
    };
  }

  return { success: true, session };
}

/**
 * Verify that user has required role
 * Returns session data if valid, or error response if not
 */
export async function requireRole(
  requiredRole: UserRole | UserRole[]
): Promise<
  { success: true; session: SessionData } | { success: false; response: NextResponse }
> {
  // First check authentication
  const authResult = await requireAuth();
  if (!authResult.success) {
    return authResult;
  }

  const { session } = authResult;

  // Check role
  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const hasRole = checkRole(session.role, requiredRoles);

  if (!hasRole) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงฟีเจอร์นี้' },
        { status: 403 }
      ),
    };
  }

  return { success: true, session };
}

/**
 * Check if user role satisfies required roles
 * - super_admin has access to everything
 * - admin has access to everything except super_admin-only
 * - sales has access to employee and sales routes
 */
function checkRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  // Super admin has access to everything
  if (userRole === 'super_admin') return true;

  // Admin has access to everything except super_admin-only
  if (userRole === 'admin' && !requiredRoles.includes('super_admin')) return true;

  // Sales has access to employee pages
  if (userRole === 'sales' && requiredRoles.includes('employee')) return true;

  // Check exact match
  return requiredRoles.includes(userRole);
}

/**
 * Require admin role (admin or super_admin)
 */
export async function requireAdmin(): Promise<
  { success: true; session: SessionData } | { success: false; response: NextResponse }
> {
  return requireRole(['admin', 'super_admin']);
}

/**
 * Require super admin role
 */
export async function requireSuperAdmin(): Promise<
  { success: true; session: SessionData } | { success: false; response: NextResponse }
> {
  return requireRole('super_admin');
}
