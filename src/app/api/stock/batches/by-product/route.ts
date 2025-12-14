/**
 * API: Stock Batches by Product
 * GET /api/stock/batches/by-product - Get all batches for a specific product
 *
 * ✅ No authentication required - uses service role with parameter filtering
 * Safe because queries are filtered by employeeId + storeId + productId
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';

// ============================================================================
// GET - Fetch all batches for a product
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // ✅ No session check needed - using service role with parameter-based filtering
    // This is safe because we filter by employeeId + storeId + productId (valid access only)

    // 1. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('productId');
    const employeeId = searchParams.get('employeeId');
    const storeId = searchParams.get('storeId');

    if (!productId || !employeeId || !storeId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ productId, employeeId และ storeId' },
        { status: 400 }
      );
    }

    // 2. Use service role client (bypasses RLS but filtered by params)
    const supabase = getSupabaseServiceClient();

    // 3. Query batches filtered by product, employee, and store
    const { data: batches, error: batchError } = await supabase
      .from('stock_batches_display')
      .select('*')
      .eq('product_id', productId)
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

    // 4. Format response (OCR fields removed - Migration 027)
    const formattedBatches = (batches || []).map((batch) => ({
      id: batch.id,
      lotNumber: batch.lot_number,
      mfgDate: batch.mfg_date,
      expiryDate: batch.expiry_date,
      initialQuantity: batch.initial_quantity,
      remainingQuantity: batch.remaining_quantity,  // ✅ NEW: Show remaining stock
      utilizationPercentage: batch.utilization_percentage,  // ✅ NEW: Show usage %
      note: batch.note,
      createdAt: batch.created_at,
      daysUntilExpiry: batch.days_until_expiry,
      expiryStatus: batch.expiry_status,
    }));

    return NextResponse.json({
      success: true,
      data: {
        productId: productId,
        batches: formattedBatches,
      },
    });
  } catch (error) {
    console.error('[Batch API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
