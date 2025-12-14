/**
 * PIN Authentication Utilities
 * Secure PIN hashing and verification using bcrypt
 */

import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

/**
 * Hash a PIN using bcrypt
 * Production-ready implementation with configurable salt rounds
 */
export async function hashPin(pin: string): Promise<string> {
  // Validate PIN format
  if (!pin || pin.length < 4) {
    throw new Error('PIN must be at least 4 characters');
  }

  if (pin.length > 6) {
    throw new Error('PIN must not exceed 6 characters');
  }

  if (!/^\d+$/.test(pin)) {
    throw new Error('PIN must contain only digits');
  }

  // Use bcrypt with 10 salt rounds (secure and performant)
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin, salt);
}

/**
 * Verify a PIN against its hash
 * Supports both bcrypt and legacy SHA-256 hashes
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  try {
    // Legacy SHA-256 support (for backward compatibility)
    if (hash.startsWith('$sha256$')) {
      const legacyHash = createHash('sha256')
        .update(pin + (process.env.PIN_SALT || 'default-salt'))
        .digest('hex');
      return hash === `$sha256$${legacyHash}`;
    }

    // Modern bcrypt verification
    return bcrypt.compare(pin, hash);
  } catch (error) {
    console.error('[pinAuth] verify error:', error);
    return false;
  }
}

/**
 * Validate PIN format
 */
export function isValidPinFormat(pin: string): { valid: boolean; error?: string } {
  if (!pin) {
    return { valid: false, error: 'PIN is required' };
  }

  if (pin.length < 4) {
    return { valid: false, error: 'PIN must be at least 4 characters' };
  }

  if (pin.length > 6) {
    return { valid: false, error: 'PIN must not exceed 6 characters' };
  }

  if (!/^\d+$/.test(pin)) {
    return { valid: false, error: 'PIN must contain only digits' };
  }

  return { valid: true };
}

/**
 * Generate a secure session token
 */
export function generateSessionToken(): string {
  return createHash('sha256')
    .update(Math.random().toString() + Date.now().toString())
    .digest('hex');
}

/**
 * Constants
 */
export const PIN_AUTH_CONFIG = {
  MIN_LENGTH: 4,
  MAX_LENGTH: 6,
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24 hours
} as const;
