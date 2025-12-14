/**
 * Authentication Types
 * Type-safe definitions for PIN-based authentication system
 */

/**
 * User roles with different permission levels
 */
export type UserRole = 'employee' | 'sales' | 'admin' | 'super_admin';

/**
 * User PIN record from database
 */
export type UserPin = {
  id: string;
  employeeId: string;
  employeeName: string;
  pinHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

/**
 * Authenticated user session
 */
export type AuthUser = {
  employeeId: string;
  employeeName: string;
  role: UserRole;
  loginAt: string;
};

/**
 * Auth context state
 */
export type AuthContextState = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (requiredRole: UserRole | UserRole[]) => boolean;
};

/**
 * Login API request
 */
export type LoginRequest = {
  pin: string;
};

/**
 * Login API response
 */
export type LoginResponse = {
  success: boolean;
  user?: AuthUser;
  error?: string;
};

/**
 * Verify session API response
 */
export type VerifySessionResponse = {
  authenticated: boolean;
  user?: AuthUser;
};

/**
 * Create PIN API request (admin only)
 */
export type CreatePinRequest = {
  employeeId: string;
  employeeName: string;
  pin: string;
  role: UserRole;
};

/**
 * Create PIN API response
 */
export type CreatePinResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

/**
 * Role permission mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, {
  label: string;
  description: string;
  color: string;
  pages: string[];
  excludedPages?: string[]; // Pages that this role CANNOT access
}> = {
  employee: {
    label: 'พนักงาน',
    description: 'ลงเวลา + บันทึกยอดขาย + สต็อก',
    color: 'blue',
    pages: ['/', '/sales', '/stock', '/admin/settings?section=leaves'],
  },
  sales: {
    label: 'Sales',
    description: 'พนักงาน + Dashboard (ดูอย่างเดียว)',
    color: 'green',
    pages: ['/', '/sales', '/stock', '/admin', '/admin/reports', '/admin/settings?section=leaves'],
  },
  admin: {
    label: 'Admin',
    description: 'เข้าถึงได้ทุกหน้ายกเว้น System Logs',
    color: 'red',
    pages: ['*'], // All pages except excludedPages
    excludedPages: ['/admin/logs'], // Admin cannot access Logs
  },
  super_admin: {
    label: 'Super Admin',
    description: 'เข้าถึงได้ทุกอย่างรวมถึง System Logs',
    color: 'purple',
    pages: ['*'], // All pages, no exceptions
  },
};

/**
 * Check if user has required role
 */
export function hasRequiredRole(
  userRole: UserRole,
  requiredRole: UserRole | UserRole[]
): boolean {
  const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  // Super Admin has access to everything
  if (userRole === 'super_admin') return true;

  // Admin has access to everything except excluded pages (handled in canAccessPage)
  if (userRole === 'admin' && !required.includes('super_admin')) return true;

  // Sales has access to employee pages
  if (userRole === 'sales' && required.includes('employee')) return true;

  // Check exact match
  return required.includes(userRole);
}

/**
 * Check if user can access a specific page
 */
export function canAccessPage(userRole: UserRole, pathname: string): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];

  // Check if page is in excluded list first
  if (permissions.excludedPages && permissions.excludedPages.length > 0) {
    const isExcluded = permissions.excludedPages.some(
      excludedPage => pathname === excludedPage || pathname.startsWith(excludedPage)
    );
    if (isExcluded) return false;
  }

  // Super Admin and Admin can access everything (except excluded pages already checked)
  if (permissions.pages.includes('*')) return true;

  // Check exact match
  if (permissions.pages.includes(pathname)) return true;

  // Check prefix match (e.g., /admin/reports/attendance matches /admin/reports)
  return permissions.pages.some(page => pathname.startsWith(page));
}

/**
 * Get navigation items for a role
 */
export function getNavigationForRole(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role].pages;
}
