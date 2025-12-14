/**
 * User PIN Management API - Individual Operations
 * Admin-only endpoints for updating/deleting specific user PINs
 */

import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';
import { hashPin, isValidPinFormat } from '@/lib/pinAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/user-pins/[id]
 * Get specific user PIN
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseServiceClient();

    const { data: userPin, error } = await supabase
      .from('user_pins')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !userPin) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูล' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      userPin,
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
 * PUT /api/admin/user-pins/[id]
 * Update user PIN (change PIN, name, role, or active status)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { employee_name, pin, role, is_active } = body;

    const supabase = getSupabaseServiceClient();

    // Build update object
    const updates: Record<string, unknown> = {};

    if (employee_name !== undefined) {
      updates.employee_name = employee_name;
    }

    if (pin !== undefined && pin !== '') {
      // Validate new PIN
      const pinValidation = isValidPinFormat(pin);
      if (!pinValidation.valid) {
        return NextResponse.json(
          { success: false, error: pinValidation.error },
          { status: 400 }
        );
      }

      // Hash new PIN
      updates.pin_hash = await hashPin(pin);
    }

    if (role !== undefined) {
      if (!['employee', 'sales', 'admin'].includes(role)) {
        return NextResponse.json(
          { success: false, error: 'Role ไม่ถูกต้อง' },
          { status: 400 }
        );
      }
      updates.role = role;
    }

    if (is_active !== undefined) {
      updates.is_active = is_active;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่มีข้อมูลที่ต้องอัปเดต' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('user_pins')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[user-pins] PUT error:', error);
      return NextResponse.json(
        { success: false, error: 'เกิดข้อผิดพลาดในการอัปเดต' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'อัปเดตสำเร็จ',
      userPin: data,
    });
  } catch (error) {
    console.error('[user-pins] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/user-pins/[id]
 * Delete user PIN
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseServiceClient();

    const { error } = await supabase
      .from('user_pins')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[user-pins] DELETE error:', error);
      return NextResponse.json(
        { success: false, error: 'เกิดข้อผิดพลาดในการลบ' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'ลบสำเร็จ',
    });
  } catch (error) {
    console.error('[user-pins] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
