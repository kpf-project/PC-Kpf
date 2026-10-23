import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function decodeJwtRef(token?: string) {
  if (!token) return { status: 'missing' };
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    return { ref: payload.ref, role: payload.role, length: token.length };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg, length: token.length };
  }
}

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const keyInfo = decodeJwtRef(process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error, status } = await supabase.from('user_pins').select('role').limit(2);
    return NextResponse.json({
      supabaseUrl: url,
      serviceKey: keyInfo,
      dbStatus: status,
      dbError: error,
      sampleData: data,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      catchError: msg,
      supabaseUrl: url,
      serviceKey: keyInfo,
    }, { status: 500 });
  }
}
