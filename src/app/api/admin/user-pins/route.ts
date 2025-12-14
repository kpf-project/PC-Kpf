/**
 * User PINs Management API
 * Admin-only endpoints for CRUD operations on user PINs
 */

import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';
import { hashPin, isValidPinFormat } from '@/lib/pinAuth';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UserPinInsert = Database['public']['Tables']['user_pins']['Insert'];

/**
 * GET /api/admin/user-pins
 * List all user PINs (admin only)
 */
export async function GET() {
  try {
    const supabase = getSupabaseServiceClient();

    const { data: userPins, error } = await supabase
      .from('user_pins')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[user-pins] GET error:', error);
      return NextResponse.json(
        { success: false, error: 'เกิดข้อผิดพลาด' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      userPins: userPins || [],
    });
  } catch (error) {
    console.error('[user-pins] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/user-pins
 * Create new user PIN (admin only)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employee_id, employee_name, pin, role } = body;

    // Validate required fields
    if (!employee_id || !employee_name || !pin || !role) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    // Validate PIN format
    const pinValidation = isValidPinFormat(pin);
    if (!pinValidation.valid) {
      return NextResponse.json(
        { success: false, error: pinValidation.error },
        { status: 400 }
      );
    }

    // Validate role
    if (!['employee', 'sales', 'admin'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Role ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Check if employee_id already exists
    const { data: existing } = await supabase
      .from('user_pins')
      .select('employee_id')
      .eq('employee_id', employee_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'รหัสพนักงานนี้มีอยู่ในระบบแล้ว' },
        { status: 409 }
      );
    }

    // Hash PIN
    const pin_hash = await hashPin(pin);

    // Insert new user PIN
    const newUserPin: UserPinInsert = {
      employee_id,
      employee_name,
      pin_hash,
      role,
      is_active: true,
    };

    const { data, error } = await supabase
      .from('user_pins')
      .insert(newUserPin)
      .select()
      .single();

    if (error) {
      console.error('[user-pins] POST error:', error);
      return NextResponse.json(
        { success: false, error: 'เกิดข้อผิดพลาดในการสร้าง PIN' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'สร้าง PIN สำเร็จ',
      userPin: data,
    });
  } catch (error) {
    console.error('[user-pins] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
