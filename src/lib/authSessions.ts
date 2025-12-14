/**
 * Server-Side Session Management
 *
 * Provides secure session management using database-backed tokens.
 * Replaces client-side cookie auth to prevent role forgery.
 *
 * Security Features:
 * - Cryptographically secure random tokens (64 chars)
 * - Server-side verification against database (single source of truth)
 * - Automatic expiration and cleanup
 * - Activity tracking for session monitoring
 *
 * @module authSessions
 */

import { getSupabaseServiceClient } from './supabaseClient';
import type { Database } from '@/types/supabase';

// ✅ Use generated types from Supabase schema
type AuthSessionRow = Database['public']['Tables']['auth_sessions']['Row'];
type AuthSessionInsert = Database['public']['Tables']['auth_sessions']['Insert'];

export type SessionData = {
  userId: string;
  role: 'employee' | 'sales' | 'admin' | 'super_admin';
  employeeId?: string | null;
};

export type SessionInfo = SessionData & {
  sessionToken: string;
  createdAt: string;
  expiresAt: string;
};

// Constants
const SESSION_DURATION_HOURS = 24;
const TOKEN_LENGTH = 64; // Must match database constraint

/**
 * Generate a cryptographically secure random session token
 *
 * Uses Web Crypto API (available in both Node.js 19+ and browsers)
 *
 * @returns {string} 64-character hexadecimal token
 */
export function generateSessionToken(): string {
  // Server-side only
  if (typeof window !== 'undefined') {
    throw new Error('Session generation must happen server-side');
  }

  // Generate cryptographically secure random bytes using Web Crypto API
  const buffer = new Uint8Array(TOKEN_LENGTH / 2);
  crypto.getRandomValues(buffer);

  // Convert to hexadecimal string
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a new session in the database
 *
 * @param {SessionData} sessionData - User session data
 * @param {Object} metadata - Optional metadata (IP, user agent)
 * @returns {Promise<SessionInfo>} Created session info
 * @throws {Error} If session creation fails
 */
export async function createSession(
  sessionData: SessionData,
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<SessionInfo> {
  const supabase = getSupabaseServiceClient();

  // Generate secure token
  const sessionToken = generateSessionToken();

  // Calculate expiration time
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  // Prepare session record
  const sessionRecord: AuthSessionInsert = {
    session_token: sessionToken,
    user_id: sessionData.userId,
    user_role: sessionData.role,
    employee_id: sessionData.employeeId || null,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    last_activity_at: now.toISOString(),
    ip_address: metadata?.ipAddress || null,
    user_agent: metadata?.userAgent || null,
  };

  // ✅ Insert into database with proper typing
  const { data, error } = await supabase
    .from('auth_sessions')
    .insert(sessionRecord)
    .select()
    .single();

  if (error) {
    console.error('[Auth Sessions] Failed to create session:', error);
    throw new Error('ไม่สามารถสร้าง session ได้');
  }

  // Return session info
  return {
    sessionToken: data.session_token,
    userId: data.user_id,
    role: data.user_role as SessionData['role'],
    employeeId: data.employee_id,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  };
}

/**
 * Verify a session token and return user data
 *
 * Uses database RPC function for atomic verification and activity update
 *
 * @param {string} sessionToken - Session token from cookie
 * @returns {Promise<SessionData | null>} User data if valid, null if invalid/expired
 */
export async function verifySession(
  sessionToken: string
): Promise<SessionData | null> {
  const supabase = getSupabaseServiceClient();

  // Call database RPC function for verification
  const { data, error } = await supabase.rpc('verify_session', {
    p_session_token: sessionToken,
  });

  if (error) {
    console.error('[Auth Sessions] Failed to verify session:', error);
    return null;
  }

  // Check if session is valid
  if (!data || data.length === 0 || !data[0]?.is_valid) {
    return null;
  }

  const session = data[0];

  // Return user data
  return {
    userId: session.user_id,
    role: session.user_role as SessionData['role'],
    employeeId: session.employee_id,
  };
}

/**
 * Delete a session (logout)
 *
 * @param {string} sessionToken - Session token to delete
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteSession(sessionToken: string): Promise<boolean> {
  const supabase = getSupabaseServiceClient();

  // ✅ Delete session with proper typing
  const { error } = await supabase
    .from('auth_sessions')
    .delete()
    .eq('session_token', sessionToken);

  if (error) {
    console.error('[Auth Sessions] Failed to delete session:', error);
    return false;
  }

  return true;
}

/**
 * Delete all sessions for a user (logout from all devices)
 *
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of sessions deleted
 */
export async function deleteUserSessions(userId: string): Promise<number> {
  const supabase = getSupabaseServiceClient();

  // ✅ Delete user sessions with proper typing
  const { data, error } = await supabase
    .from('auth_sessions')
    .delete()
    .eq('user_id', userId)
    .select();

  if (error) {
    console.error('[Auth Sessions] Failed to delete user sessions:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Get all active sessions for a user
 *
 * @param {string} userId - User ID
 * @returns {Promise<AuthSessionRow[]>} List of active sessions
 */
export async function getUserSessions(userId: string): Promise<AuthSessionRow[]> {
  const supabase = getSupabaseServiceClient();

  // ✅ Get user sessions with proper typing
  const { data, error } = await supabase
    .from('auth_sessions')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Auth Sessions] Failed to get user sessions:', error);
    return [];
  }

  return data || [];
}

/**
 * Cleanup expired sessions (should be run periodically via cron)
 *
 * @returns {Promise<number>} Number of sessions cleaned up
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const supabase = getSupabaseServiceClient();

  const { error } = await supabase.rpc('cleanup_expired_sessions');

  if (error) {
    console.error('[Auth Sessions] Failed to cleanup expired sessions:', error);
    return 0;
  }

  // ✅ Query how many sessions are still active with proper typing
  const { count } = await supabase
    .from('auth_sessions')
    .select('*', { count: 'exact', head: true });

  return count || 0;
}

/**
 * Update session activity timestamp
 *
 * Called automatically by verify_session RPC function,
 * but can also be called manually for long-running operations
 *
 * @param {string} sessionToken - Session token
 * @returns {Promise<boolean>} True if updated successfully
 */
export async function updateSessionActivity(sessionToken: string): Promise<boolean> {
  const supabase = getSupabaseServiceClient();

  // ✅ Update session activity with proper typing
  const { error } = await supabase
    .from('auth_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('session_token', sessionToken);

  if (error) {
    console.error('[Auth Sessions] Failed to update session activity:', error);
    return false;
  }

  return true;
}
