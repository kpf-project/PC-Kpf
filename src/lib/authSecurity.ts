/**
 * Auth Security Utilities
 * Audit logging and rate limiting for authentication
 */

import { getSupabaseServiceClient } from './supabaseClient';
import type { Database } from '@/types/supabase';

type AuditLog = Database['public']['Tables']['auth_audit_logs']['Insert'];
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Log authentication attempt
 */
export async function logAuthAttempt(params: {
  employeeId: string | null;
  employeeName: string | null;
  success: boolean;
  failureReason?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();

    const auditLog: AuditLog = {
      employee_id: params.employeeId,
      employee_name: params.employeeName,
      success: params.success,
      failure_reason: params.failureReason || null,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
    };

    const { error } = await supabase
      .from('auth_audit_logs')
      .insert(auditLog);

    if (error) {
      console.error('[authSecurity] Failed to log audit:', error);
    }
  } catch (error) {
    console.error('[authSecurity] logAuthAttempt error:', error);
  }
}

/**
 * Check if account is locked due to rate limiting
 * Returns: { isLocked: boolean, lockedUntil?: Date, remainingMinutes?: number }
 */
export async function checkRateLimit(employeeId: string): Promise<{
  isLocked: boolean;
  lockedUntil?: Date;
  remainingMinutes?: number;
  failedAttempts?: number;
}> {
  try {
    const supabase = getSupabaseServiceClient();

    const { data: rateLimit } = await supabase
      .from('auth_rate_limits')
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    if (!rateLimit) {
      return { isLocked: false };
    }

    // Check if locked
    if (rateLimit.locked_until) {
      const lockedUntil = new Date(rateLimit.locked_until);
      const now = new Date();

      if (lockedUntil > now) {
        const remainingMs = lockedUntil.getTime() - now.getTime();
        const remainingMinutes = Math.ceil(remainingMs / 60000);

        return {
          isLocked: true,
          lockedUntil,
          remainingMinutes,
          failedAttempts: rateLimit.failed_attempts,
        };
      } else {
        // Lock expired, reset it
        await resetRateLimit(employeeId);
        return { isLocked: false };
      }
    }

    return {
      isLocked: false,
      failedAttempts: rateLimit.failed_attempts,
    };
  } catch (error) {
    console.error('[authSecurity] checkRateLimit error:', error);
    return { isLocked: false };
  }
}

/**
 * Record failed login attempt
 * Returns: { shouldLock: boolean, attempts: number }
 */
export async function recordFailedAttempt(employeeId: string): Promise<{
  shouldLock: boolean;
  attempts: number;
  lockedUntil?: Date;
}> {
  try {
    const supabase = getSupabaseServiceClient();

    // Get current rate limit
    const { data: currentLimit } = await supabase
      .from('auth_rate_limits')
      .select('*')
      .eq('employee_id', employeeId)
      .single();

    const now = new Date();
    const newAttempts = (currentLimit?.failed_attempts || 0) + 1;
    const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = shouldLock
      ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
      : null;

    if (currentLimit) {
      // Update existing record
      await supabase
        .from('auth_rate_limits')
        .update({
          failed_attempts: newAttempts,
          last_failed_at: now.toISOString(),
          locked_until: lockedUntil?.toISOString() || null,
        })
        .eq('employee_id', employeeId);
    } else {
      // Create new record
      await supabase
        .from('auth_rate_limits')
        .insert({
          employee_id: employeeId,
          failed_attempts: newAttempts,
          last_failed_at: now.toISOString(),
          locked_until: lockedUntil?.toISOString() || null,
        });
    }

    return {
      shouldLock,
      attempts: newAttempts,
      lockedUntil: lockedUntil || undefined,
    };
  } catch (error) {
    console.error('[authSecurity] recordFailedAttempt error:', error);
    return { shouldLock: false, attempts: 0 };
  }
}

/**
 * Reset rate limit (on successful login or manual reset)
 */
export async function resetRateLimit(employeeId: string): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();

    await supabase
      .from('auth_rate_limits')
      .delete()
      .eq('employee_id', employeeId);
  } catch (error) {
    console.error('[authSecurity] resetRateLimit error:', error);
  }
}

/**
 * Get audit logs for an employee
 */
export async function getAuditLogs(params: {
  employeeId?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  logs: Array<Database['public']['Tables']['auth_audit_logs']['Row']>;
  total: number;
}> {
  try {
    const supabase = getSupabaseServiceClient();
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    let query = supabase
      .from('auth_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.employeeId) {
      query = query.eq('employee_id', params.employeeId);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[authSecurity] getAuditLogs error:', error);
      return { logs: [], total: 0 };
    }

    return {
      logs: data || [],
      total: count || 0,
    };
  } catch (error) {
    console.error('[authSecurity] getAuditLogs error:', error);
    return { logs: [], total: 0 };
  }
}

/**
 * Get rate limit statistics
 */
export async function getRateLimitStats(): Promise<{
  lockedAccounts: number;
  accountsWithFailures: number;
  totalFailedAttempts: number;
}> {
  try {
    const supabase = getSupabaseServiceClient();

    const { data: limits } = await supabase
      .from('auth_rate_limits')
      .select('*');

    if (!limits) {
      return {
        lockedAccounts: 0,
        accountsWithFailures: 0,
        totalFailedAttempts: 0,
      };
    }

    const now = new Date();
    const lockedAccounts = limits.filter(
      l => l.locked_until && new Date(l.locked_until) > now
    ).length;

    const accountsWithFailures = limits.filter(
      l => l.failed_attempts > 0
    ).length;

    const totalFailedAttempts = limits.reduce(
      (sum, l) => sum + l.failed_attempts,
      0
    );

    return {
      lockedAccounts,
      accountsWithFailures,
      totalFailedAttempts,
    };
  } catch (error) {
    console.error('[authSecurity] getRateLimitStats error:', error);
    return {
      lockedAccounts: 0,
      accountsWithFailures: 0,
      totalFailedAttempts: 0,
    };
  }
}

/**
 * Extract IP address from request
 */
export function getClientIp(request: Request): string | undefined {
  // Try various headers (depending on proxy/CDN setup)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return undefined;
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined;
}
