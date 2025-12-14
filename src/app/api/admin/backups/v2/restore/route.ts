/**
 * Backup Restore API
 *
 * POST /api/admin/backups/v2/restore
 * Restores data from a specific backup snapshot
 */

import { NextResponse } from 'next/server';
import { restoreBackup, getBackup } from '@/lib/supabaseBackup';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';
import * as supabaseLogs from '@/lib/supabaseLogs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Type for backup data structure
interface BackupData {
  version: string;
  timestamp: string;
  data: {
    employees?: unknown[];
    stores?: unknown[];
    products?: unknown[];
    categories?: unknown[];
    attendance?: unknown[];
    sales?: unknown[];
    stockInventory?: unknown[];
    userPins?: unknown[];
  };
  metadata: {
    employeesCount: number;
    storesCount: number;
    productsCount: number;
    attendanceCount: number;
    salesCount: number;
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { snapshotName, restoredBy } = body as {
      snapshotName: string;
      restoredBy: string;
    };

    if (!snapshotName) {
      return NextResponse.json(
        { ok: false, error: 'กรุณาระบุชื่อสำรองข้อมูล' },
        { status: 400 }
      );
    }

    if (!restoredBy) {
      return NextResponse.json(
        { ok: false, error: 'กรุณาระบุผู้ทำการกู้คืน' },
        { status: 400 }
      );
    }

    // Verify backup exists
    const backupInfo = await getBackup(snapshotName);
    if (!backupInfo) {
      return NextResponse.json(
        { ok: false, error: 'ไม่พบสำรองข้อมูลที่ระบุ' },
        { status: 404 }
      );
    }

    // Restore data from backup
    const restoredData = await restoreBackup<BackupData>(snapshotName);

    // Validate backup structure
    if (!restoredData.version || !restoredData.data) {
      throw new Error('รูปแบบข้อมูลสำรองไม่ถูกต้อง');
    }

    const supabase = getSupabaseServiceClient();

    // Begin restore process
    // Note: This is a simplified restore that doesn't wipe existing data
    // For production, you might want to add options for:
    // 1. Full restore (delete all + restore)
    // 2. Merge restore (keep existing + add missing)
    // 3. Selective restore (only certain tables)

    let restoredCount = 0;

    // Restore employees (if any in backup)
    if (restoredData.data.employees && restoredData.data.employees.length > 0) {
      // This is a merge approach - you might want different logic
      for (const employee of restoredData.data.employees) {
        const { error } = await supabase
          .from('employees')
          .upsert(employee as never, { onConflict: 'id' });
        if (!error) restoredCount++;
      }
    }

    // Restore stores
    if (restoredData.data.stores && restoredData.data.stores.length > 0) {
      for (const store of restoredData.data.stores) {
        const { error } = await supabase
          .from('stores')
          .upsert(store as never, { onConflict: 'id' });
        if (!error) restoredCount++;
      }
    }

    // Restore products
    if (restoredData.data.products && restoredData.data.products.length > 0) {
      for (const product of restoredData.data.products) {
        const { error } = await supabase
          .from('products')
          .upsert(product as never, { onConflict: 'id' });
        if (!error) restoredCount++;
      }
    }

    // Restore categories
    if (restoredData.data.categories && restoredData.data.categories.length > 0) {
      for (const category of restoredData.data.categories) {
        const { error } = await supabase
          .from('categories')
          .upsert(category as never, { onConflict: 'id' });
        if (!error) restoredCount++;
      }
    }

    // Log the restore operation
    await supabaseLogs.addLog({
      timestamp: new Date().toISOString(),
      scope: 'system',
      action: 'restore',
      details: `กู้คืนข้อมูลจาก: ${snapshotName} โดย ${restoredBy}`,
      metadata: {
        snapshotName,
        restoredBy,
        backupTimestamp: restoredData.timestamp,
        restoredCount,
        metadata: restoredData.metadata,
      },
    });

    return NextResponse.json({
      ok: true,
      message: 'กู้คืนข้อมูลสำเร็จ',
      data: {
        snapshotName,
        backupTimestamp: restoredData.timestamp,
        restoredCount,
        metadata: restoredData.metadata,
      },
    });
  } catch (error) {
    console.error('[Backups V2] Restore error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'ไม่สามารถกู้คืนข้อมูลได้',
      },
      { status: 500 }
    );
  }
}
