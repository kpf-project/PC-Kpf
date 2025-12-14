import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/authSessions';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';
import type { AuthUser } from '@/types/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Verify Session Endpoint
 *
 * Returns user data for authenticated sessions
 * Used by AuthContext to fetch user info on initial load
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    // Get session token from cookie
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    // Verify session with database
    const sessionData = await verifySession(sessionCookie.value);

    if (!sessionData) {
      // Session invalid or expired
      // For old cookie format, ask user to re-login
      console.log('[verify] Session not found in database - user needs to re-login');
      return NextResponse.json(
        { authenticated: false, message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' },
        { status: 401 }
      );
    }

    // Get full user data from user_pins table
    const supabase = getSupabaseServiceClient();
    const { data: userPin, error } = await supabase
      .from('user_pins')
      .select('id, employee_id, employee_name, role')
      .eq('id', sessionData.userId)
      .single();

    if (error || !userPin) {
      console.error('[verify] user not found:', error);
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    // Return user data for client
    const authUser: AuthUser = {
      employeeId: userPin.employee_id,
      employeeName: userPin.employee_name,
      role: userPin.role as 'employee' | 'sales' | 'admin' | 'super_admin',
      loginAt: new Date().toISOString(),
    };

    return NextResponse.json({
      authenticated: true,
      user: authUser,
    });
  } catch (error) {
    console.error('[verify] error:', error);
    return NextResponse.json(
      { authenticated: false, error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
