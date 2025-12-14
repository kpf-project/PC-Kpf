/**
 * API: Stock Batches by Inventory
 * GET /api/stock/batches/by-inventory - Get batch data for all products in inventory
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as authSessions from '@/lib/authSessions';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';

// ============================================================================
// Types
// ============================================================================

interface BatchSummary {
  productId: string;
  productCode: string;
  productName: string;
  nearestExpiry: {
    batchId: string;
    lotNumber: string;
    expiryDate: string;
    mfgDate: string | null;
    daysUntilExpiry: number;
    expiryStatus: 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry';
  } | null;
  totalBatches: number;
  criticalCount: number; // Batches expiring in ≤7 days
  warningCount: number; // Batches expiring in ≤30 days
}

// ============================================================================
// GET - Fetch batch summaries for inventory
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // 1. Verify authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบ session' },
        { status: 401 }
      );
    }

    const session = await authSessions.verifySession(sessionToken);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session หมดอายุ' },
        { status: 401 }
      );
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId');
    const storeId = searchParams.get('storeId');

    if (!employeeId || !storeId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ employeeId และ storeId' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // 3. Get all batches for this employee/store
    const { data: batches, error: batchError } = await supabase
      .from('stock_batches_display')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('store_id', storeId)
      .order('expiry_date', { ascending: true, nullsFirst: false });

    if (batchError) {
      console.error('[Batch API] Query error:', batchError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูล batch ได้' },
        { status: 500 }
      );
    }

    // 3.5. Get products for product_code and product_name (TEMPORARY: until types regenerated)
    const productIds = Array.from(new Set((batches || []).map(b => b.product_id).filter((id): id is string => id !== null)));
    const { data: products } = await supabase
      .from('products')
      .select('id, code, name')
      .in('id', productIds);

    const productMap = new Map(products?.map(p => [p.id, { code: p.code, name: p.name }]) || []);

    // 4. Group by product and find nearest expiry for each
    const batchMap = new Map<string, BatchSummary>();

    for (const batch of batches || []) {
      const productId = batch.product_id;

      // Skip batches with null product_id
      if (!productId) continue;

      if (!batchMap.has(productId)) {
        // Initialize product entry
        const product = productMap.get(productId);
        batchMap.set(productId, {
          productId: productId,
          productCode: product?.code || '',
          productName: product?.name || '',
          nearestExpiry: null,
          totalBatches: 0,
          criticalCount: 0,
          warningCount: 0,
        });
      }

      const summary = batchMap.get(productId)!;
      summary.totalBatches++;

      // Count by status
      if (batch.expiry_status === 'critical' || batch.expiry_status === 'expired') {
        summary.criticalCount++;
      } else if (batch.expiry_status === 'warning') {
        summary.warningCount++;
      }

      // Set nearest expiry (first one with expiry_date, already sorted)
      // OCR fields removed - Migration 027
      if (!summary.nearestExpiry && batch.expiry_date && batch.id && batch.lot_number && batch.days_until_expiry !== null && batch.expiry_status) {
        summary.nearestExpiry = {
          batchId: batch.id,
          lotNumber: batch.lot_number,
          expiryDate: batch.expiry_date,
          mfgDate: batch.mfg_date,
          daysUntilExpiry: batch.days_until_expiry,
          expiryStatus: batch.expiry_status as 'ok' | 'warning' | 'critical' | 'expired' | 'no_expiry',
        };
      }
    }

    // 5. Convert to array
    const summaries = Array.from(batchMap.values());

    return NextResponse.json({
      success: true,
      data: summaries,
    });
  } catch (error) {
    console.error('[Batch API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
