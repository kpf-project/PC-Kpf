/**
 * API Response Utilities
 *
 * Provides standardized response formats for all API endpoints
 */

import { NextResponse } from 'next/server';

/**
 * Standard API response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  };
  metadata?: {
    timestamp: string;
    requestId?: string;
    [key: string]: unknown;
  };
}

/**
 * Success response helper
 */
export function successResponse<T>(
  data: T,
  metadata?: Record<string, unknown>,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata
    }
  };

  return NextResponse.json(response, { status });
}

/**
 * Error response helper
 */
export function errorResponse(
  message: string,
  options?: {
    code?: string;
    details?: Record<string, unknown>;
    status?: number;
    metadata?: Record<string, unknown>;
  }
): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error: {
      message,
      code: options?.code,
      details: options?.details
    },
    metadata: {
      timestamp: new Date().toISOString(),
      ...options?.metadata
    }
  };

  return NextResponse.json(response, {
    status: options?.status || 400
  });
}

/**
 * Validation error response
 */
export function validationError(
  message: string,
  fields?: Record<string, string>
): NextResponse<ApiResponse> {
  return errorResponse(message, {
    code: 'VALIDATION_ERROR',
    details: { fields },
    status: 400
  });
}

/**
 * Unauthorized error response
 */
export function unauthorizedError(
  message: string = 'กรุณาเข้าสู่ระบบก่อนใช้งาน'
): NextResponse<ApiResponse> {
  return errorResponse(message, {
    code: 'UNAUTHORIZED',
    status: 401
  });
}

/**
 * Forbidden error response
 */
export function forbiddenError(
  message: string = 'คุณไม่มีสิทธิ์เข้าถึงฟีเจอร์นี้'
): NextResponse<ApiResponse> {
  return errorResponse(message, {
    code: 'FORBIDDEN',
    status: 403
  });
}

/**
 * Not found error response
 */
export function notFoundError(
  message: string = 'ไม่พบข้อมูลที่ต้องการ'
): NextResponse<ApiResponse> {
  return errorResponse(message, {
    code: 'NOT_FOUND',
    status: 404
  });
}

/**
 * Internal server error response
 */
export function internalError(
  message: string = 'เกิดข้อผิดพลาดภายในระบบ',
  details?: Record<string, unknown>
): NextResponse<ApiResponse> {
  return errorResponse(message, {
    code: 'INTERNAL_ERROR',
    details,
    status: 500
  });
}

/**
 * Rate limit error response
 */
export function rateLimitError(
  resetAt: number,
  remaining: number = 0
): NextResponse<ApiResponse> {
  const response = errorResponse('คำขอเกินจำนวนที่กำหนด กรุณารอสักครู่', {
    code: 'RATE_LIMIT_EXCEEDED',
    details: {
      resetAt: new Date(resetAt).toISOString(),
      remaining
    },
    status: 429
  });

  // Add rate limit headers
  const headers = new Headers(response.headers);
  headers.set('Retry-After', String(Math.ceil((resetAt - Date.now()) / 1000)));
  headers.set('X-RateLimit-Reset', String(Math.floor(resetAt / 1000)));

  return new NextResponse(response.body, {
    status: 429,
    statusText: response.statusText,
    headers
  });
}
