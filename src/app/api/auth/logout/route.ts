import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSession } from '@/lib/authSessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Get session token from cookie
    const sessionCookie = cookieStore.get('session');

    if (sessionCookie) {
      // ✅ Delete session from database
      await deleteSession(sessionCookie.value);
    }

    // ✅ Clear session cookie
    cookieStore.delete('session');

    // ❌ REMOVED: Old cookies (no longer used)
    // cookieStore.delete('auth-session');
    // cookieStore.delete('auth-user');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[logout] error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
