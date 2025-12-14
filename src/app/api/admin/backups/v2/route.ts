/**
 * Backup Management API (V2)
 *
 * Production-ready backup system using Supabase Storage
 * Routes:
 * - GET /api/admin/backups/v2 - List all backups
 * - POST /api/admin/backups/v2 - Create new backup
 * - DELETE /api/admin/backups/v2 - Delete backup
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  listBackups,
  createManualBackup,
  deleteBackup,
  getBackupStats,
  cleanupExpiredBackups,
  enforceRetentionPolicy,
} from '@/lib/supabaseBackup';
import type { BackupType } from '@/lib/supabaseBackup';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================
// Helper: Get current data snapshot
// =============================================
async function getCurrentDataSnapshot() {
  const supabase = getSupabaseServiceClient();

  // Fetch all critical data for backup
  const [
    { data: employees },
    { data: stores },
    { data: products },
    { data: categories },
    { data: attendance },
    { data: sales },
    { data: stockInventory },
    { data: userPins },
  ] = await Promise.all([
    supabase.from('employees').select('*').order('name'),
    supabase.from('stores').select('*').order('name'),
    supabase.from('products').select('*').order('name'),
    supabase.from('categories').select('*').order('name'),
    supabase
      .from('attendance_records')
      .select('*')
      .order('recorded_date', { ascending: false })
      .limit(10000), // Last 10k records
    supabase
      .from('sales_records')
      .select('*')
      .order('recorded_date', { ascending: false })
      .limit(10000), // Last 10k records
    supabase.from('stock_inventory').select('*'),
    supabase.from('user_pins').select('id, employee_id, role, is_active'),
  ]);

  return {
    version: '2.0',
    timestamp: new Date().toISOString(),
    data: {
      employees: employees ?? [],
      stores: stores ?? [],
      products: products ?? [],
      categories: categories ?? [],
      attendance: attendance ?? [],
      sales: sales ?? [],
      stockInventory: stockInventory ?? [],
      userPins: userPins ?? [],
    },
    metadata: {
      employeesCount: employees?.length ?? 0,
      storesCount: stores?.length ?? 0,
      productsCount: products?.length ?? 0,
      attendanceCount: attendance?.length ?? 0,
      salesCount: sales?.length ?? 0,
    },
  };
}

// =============================================
// GET - List all backups
// =============================================
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // Special actions
    if (action === 'stats') {
      const stats = await getBackupStats();
      return NextResponse.json({ ok: true, data: stats });
    }

    if (action === 'cleanup') {
      const deleted = await cleanupExpiredBackups();
      return NextResponse.json({
        ok: true,
        message: `ลบสำรองข้อมูลที่หมดอายุแล้ว ${deleted} รายการ`,
        deleted,
      });
    }

    if (action === 'enforce-retention') {
      const result = await enforceRetentionPolicy();
      return NextResponse.json({
        ok: true,
        message: 'บังคับใช้นโยบายการเก็บข้อมูลสำเร็จ',
        result,
      });
    }

    // List backups with optional filtering
    const type = searchParams.get('type') as BackupType | null;
    const limit = searchParams.get('limit');
    const includeExpired = searchParams.get('includeExpired') === 'true';

    const backups = await listBackups({
      type: type ?? undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      includeExpired,
    });

    return NextResponse.json({
      ok: true,
      data: backups,
      count: backups.length,
    });
  } catch (error) {
    console.error('[Backups V2] GET error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'ไม่สามารถดึงรายการสำรองข้อมูลได้',
      },
      { status: 500 }
    );
  }
}

// =============================================
// POST - Create new backup
// =============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, createdBy } = body as {
      description?: string;
      createdBy: string;
    };

    if (!createdBy) {
      return NextResponse.json(
        { ok: false, error: 'กรุณาระบุผู้สร้างสำรองข้อมูล' },
        { status: 400 }
      );
    }

    // Get current data snapshot
    const snapshot = await getCurrentDataSnapshot();

    // Create backup
    const backup = await createManualBackup(snapshot, createdBy, description);

    return NextResponse.json({
      ok: true,
      message: 'สร้างสำรองข้อมูลสำเร็จ',
      data: backup,
    });
  } catch (error) {
    console.error('[Backups V2] POST error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'ไม่สามารถสร้างสำรองข้อมูลได้',
      },
      { status: 500 }
    );
  }
}

// =============================================
// DELETE - Delete backup
// =============================================
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const snapshotName = searchParams.get('name');

    if (!snapshotName) {
      return NextResponse.json(
        { ok: false, error: 'กรุณาระบุชื่อสำรองข้อมูล' },
        { status: 400 }
      );
    }

    const success = await deleteBackup(snapshotName);

    if (!success) {
      return NextResponse.json(
        { ok: false, error: 'ไม่พบสำรองข้อมูลที่ระบุ' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'ลบสำรองข้อมูลสำเร็จ',
    });
  } catch (error) {
    console.error('[Backups V2] DELETE error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'ไม่สามารถลบสำรองข้อมูลได้',
      },
      { status: 500 }
    );
  }
}
