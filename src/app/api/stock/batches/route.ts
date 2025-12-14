/**
 * API: Stock Batches
 * POST /api/stock/batches - Create new batch
 * GET /api/stock/batches - List batches
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as authSessions from '@/lib/authSessions';
import * as supabaseLogs from '@/lib/supabaseLogs';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';
import type { Database } from '@/types/supabase';

// Note: POST endpoint requires authentication for data creation
// GET endpoint is public (like /api/stock/inventory) - admin panel access protected by middleware

// ============================================================================
// POST /api/stock/batches - Create new batch
// ============================================================================

export async function POST(request: NextRequest) {
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

    // 2. Parse request body
    const body = await request.json();
    const {
      productId,
      employeeId,
      storeId,
      lotNumber,
      mfgDate,
      expDate,
      initialQuantity,
      transactionId,
      note,
    } = body;

    // 3. Validate required fields
    if (!productId || !employeeId || !storeId) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // At least one date should be provided
    if (!mfgDate && !expDate) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุวันที่ผลิตหรือวันหมดอายุ' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // 4. Insert batch record (manual entry only - no OCR)
    const { data: batch, error: batchError } = await supabase
      .from('stock_batches')
      .insert({
        product_id: productId,
        employee_id: employeeId,
        store_id: storeId,
        lot_number: lotNumber || null, // Auto-generated if null
        mfg_date: mfgDate || null,
        expiry_date: expDate || null,
        initial_quantity: initialQuantity || null,
        created_by: session.userId,
        note: note || null,
      })
      .select()
      .single();

    if (batchError) {
      console.error('[Batch API] Insert error:', batchError);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถบันทึก batch ได้' },
        { status: 500 }
      );
    }

    // 6. Link batch to transaction (if transactionId provided)
    if (transactionId) {
      await supabase
        .from('stock_transactions')
        .update({ batch_id: batch.id })
        .eq('id', transactionId);
    }

    // 7. Log the action
    await supabaseLogs.addLog({
      timestamp: new Date().toISOString(),
      scope: 'stock',
      action: 'create_batch',
      details: `สร้าง batch ${batch.lot_number} สำหรับสินค้า ${productId}`,
      metadata: {
        batchId: batch.id,
        lotNumber: batch.lot_number,
        productId: productId,
        mfgDate: mfgDate,
        expDate: expDate,
      },
    });

    // 8. Return success
    return NextResponse.json({
      success: true,
      data: {
        id: batch.id,
        lotNumber: batch.lot_number,
        mfgDate: batch.mfg_date,
        expDate: batch.expiry_date,
      },
    });
  } catch (error) {
    console.error('[Batch API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/stock/batches - List batches
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Note: No authentication required (consistent with /api/stock/inventory)
    // Admin panel access is already protected by middleware

    // 1. Parse query parameters (support both camelCase and snake_case)
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('product_id') || searchParams.get('productId');
    const storeId = searchParams.get('store_id') || searchParams.get('storeId');
    const employeeId = searchParams.get('employee_id') || searchParams.get('employeeId');
    const expiryStatus = searchParams.get('expiry_status') || searchParams.get('expiryStatus'); // 'expired' | 'critical' | 'warning' | 'ok'

    const supabase = getSupabaseServiceClient();

    // 2. Query batches using display view
    let query = supabase
      .from('stock_batches_display')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (productId) {
      query = query.eq('product_id', productId);
    }
    if (storeId) {
      query = query.eq('store_id', storeId);
    }
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    if (expiryStatus) {
      query = query.eq('expiry_status', expiryStatus);
    }

    const { data: batches, error } = await query;

    if (error) {
      console.error('[Batch API] GET error:', error);
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถดึงข้อมูล batch ได้' },
        { status: 500 }
      );
    }

    // Transform to camelCase for frontend consistency
    type StockBatchDisplayRow = Database['public']['Views']['stock_batches_display']['Row'];
    const transformedBatches = (batches || []).map((batch: StockBatchDisplayRow) => ({
      batchId: batch.id,
      lotNumber: batch.lot_number,
      productId: batch.product_id,
      employeeId: batch.employee_id,
      storeId: batch.store_id,
      mfgDate: batch.mfg_date,
      expiryDate: batch.expiry_date,
      initialQuantity: batch.initial_quantity,
      note: batch.note,
      createdAt: batch.created_at,
      daysUntilExpiry: batch.days_until_expiry,
      expiryStatus: batch.expiry_status,
      productName: batch.product_name,
      productCode: batch.product_code,
      quantityInBase: batch.initial_quantity || 0, // For display
      displayText: `${batch.initial_quantity || 0}`, // Simple display for now
    }));

    return NextResponse.json({
      success: true,
      batches: transformedBatches,
    });
  } catch (error) {
    console.error('[Batch API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในระบบ' },
      { status: 500 }
    );
  }
}
