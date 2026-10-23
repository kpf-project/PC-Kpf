import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';
import { verifyPin } from '@/lib/pinAuth';
import { createSession } from '@/lib/authSessions';
import {
  checkRateLimit,

  resetRateLimit,
  logAuthAttempt,
  getClientIp,
  getUserAgent,
} from '@/lib/authSecurity';
import type { LoginRequest, LoginResponse, AuthUser } from '@/types/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SESSION_MAX_AGE = 24 * 60 * 60; // 24 hours

export async function POST(request: Request) {
  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);

  try {
    let body: Partial<LoginRequest>;
    try {
      body = (await request.json()) as Partial<LoginRequest>;
    } catch (jsonError) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { pin } = body;

    // Validate PIN format
    if (!pin || pin.length < 4) {
      await logAuthAttempt({
        employeeId: null,
        employeeName: null,
        success: false,
        failureReason: 'invalid_format',
        ipAddress,
        userAgent,
      });

      return NextResponse.json<LoginResponse>(
        { success: false, error: 'PIN ต้องมีอย่างน้อย 4 หลัก' },
        { status: 400 }
      );
    }

    // Get Supabase client
    const supabase = getSupabaseServiceClient();

    // Query all active user PINs
    const { data: userPins, error: queryError } = await supabase
      .from('user_pins')
      .select('*')
      .eq('is_active', true);

    if (queryError) {
      console.error('[login] database error:', queryError);
      return NextResponse.json<LoginResponse>(
        { success: false, error: `เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ${queryError.message || JSON.stringify(queryError)}` },
        { status: 500 }
      );
    }

    if (!userPins || userPins.length === 0) {
      return NextResponse.json<LoginResponse>(
        { success: false, error: 'ไม่พบข้อมูลผู้ใช้งาน กรุณาติดต่อผู้ดูแลระบบ' },
        { status: 404 }
      );
    }

    // Find matching PIN
    let matchedUser: typeof userPins[0] | null = null;
    for (const user of userPins) {
      const isMatch = await verifyPin(pin, user.pin_hash);
      if (isMatch) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      // Log failed attempt (no employee_id since PIN not found)
      await logAuthAttempt({
        employeeId: null,
        employeeName: null,
        success: false,
        failureReason: 'invalid_pin',
        ipAddress,
        userAgent,
      });

      return NextResponse.json<LoginResponse>(
        { success: false, error: 'PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' },
        { status: 401 }
      );
    }

    // Check rate limit for this employee
    const rateLimitCheck = await checkRateLimit(matchedUser.employee_id);

    if (rateLimitCheck.isLocked) {
      // Log locked account attempt
      await logAuthAttempt({
        employeeId: matchedUser.employee_id,
        employeeName: matchedUser.employee_name,
        success: false,
        failureReason: 'account_locked',
        ipAddress,
        userAgent,
      });

      return NextResponse.json<LoginResponse>(
        {
          success: false,
          error: `บัญชีถูกล็อคชั่วคราว กรุณารออีก ${rateLimitCheck.remainingMinutes} นาที`,
        },
        { status: 429 }
      );
    }

    // Update last_login_at
    await supabase
      .from('user_pins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', matchedUser.id);

    // Reset rate limit on successful login
    await resetRateLimit(matchedUser.employee_id);

    // Log successful login
    await logAuthAttempt({
      employeeId: matchedUser.employee_id,
      employeeName: matchedUser.employee_name,
      success: true,
      ipAddress,
      userAgent,
    });

    // ✅ Create server-side session in database
    const session = await createSession(
      {
        userId: matchedUser.id,
        role: matchedUser.role as 'employee' | 'sales' | 'admin' | 'super_admin',
        employeeId: matchedUser.employee_id,
      },
      {
        ipAddress,
        userAgent,
      }
    );

    // Prepare user data for response
    const authUser: AuthUser = {
      employeeId: matchedUser.employee_id,
      employeeName: matchedUser.employee_name,
      role: matchedUser.role as 'employee' | 'sales' | 'admin' | 'super_admin',
      loginAt: new Date().toISOString(),
    };

    // ✅ Store ONLY session token in HttpOnly cookie (client cannot read/modify)
    const cookieStore = await cookies();
    cookieStore.set('session', session.sessionToken, {
      httpOnly: true, // JavaScript cannot access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });

    // ❌ REMOVED: auth-user cookie (security vulnerability)
    // User data will be fetched from database via session verification


    return NextResponse.json<LoginResponse>({
      success: true,
      user: authUser,
    });
  } catch (error) {
    console.error('[login] error:', error);
    return NextResponse.json<LoginResponse>(
      { success: false, error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
