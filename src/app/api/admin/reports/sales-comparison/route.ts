/**
 * API Route: Sales Comparison Report
 * GET /api/admin/reports/sales-comparison
 *
 * รายงานเปรียบเทียบยอดขายทั้งปี แยกตามสินค้า และเดือน
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';
import { generateSalesComparisonReport } from '@/lib/salesComparisonQuery';
import { getBranding } from '@/lib/configStore';
import { listEmployeesFromSupabase, listStoresFromSupabase } from "@/lib/supabaseDirectory";
import type { SalesComparisonResponse } from '@/types/sales-comparison';

/**
 * GET handler
 * Query parameters:
 * - employeeId: string (required)
 * - year: number (required)
 * - storeId: string (optional)
 * - startMonth: number (optional, 1-12, default: 1)
 * - endMonth: number (optional, 1-12, default: 12)
 * - format: 'json' | 'xlsx' | 'csv' (optional, default: json)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Validate required parameters
    const employeeId = searchParams.get('employeeId');
    const yearParam = searchParams.get('year');

    if (!employeeId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: employeeId',
        } as SalesComparisonResponse,
        { status: 400 }
      );
    }

    if (!yearParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: year',
        } as SalesComparisonResponse,
        { status: 400 }
      );
    }

    const year = parseInt(yearParam, 10);
    if (isNaN(year)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid year parameter',
        } as SalesComparisonResponse,
        { status: 400 }
      );
    }

    // Optional parameters
    const storeId = searchParams.get('storeId') || undefined;
    const format = searchParams.get('format') || 'json';

    // Month range parameters (default: full year)
    const startMonthParam = searchParams.get('startMonth');
    const endMonthParam = searchParams.get('endMonth');

    const startMonth = startMonthParam ? parseInt(startMonthParam, 10) : 1;
    const endMonth = endMonthParam ? parseInt(endMonthParam, 10) : 12;

    // Validate month range
    if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid month range (must be between 1-12)',
        } as SalesComparisonResponse,
        { status: 400 }
      );
    }

    if (startMonth > endMonth) {
      return NextResponse.json(
        {
          success: false,
          error: 'Start month cannot be greater than end month',
        } as SalesComparisonResponse,
        { status: 400 }
      );
    }

    // Lookup employee, store names, and branding from configStore BEFORE generating report
    const [employees, stores, branding] = await Promise.all([
      listEmployeesFromSupabase(),
      listStoresFromSupabase(),
      getBranding(),
    ]);

    const employee = employees?.find((e) => e.id === employeeId);
    const store = storeId
      ? stores?.find((s) => s.id === storeId)
      : undefined;

    if (!employee) {
      return NextResponse.json(
        {
          success: false,
          error: 'Employee not found',
        } as SalesComparisonResponse,
        { status: 404 }
      );
    }

    const employeeName = employee.name;
    const employeeCode = employee.employeeCode ?? null;
    const phone = employee.phone ?? null;
    const region = employee.region ?? null;
    const regularDayOff = employee.regularDayOff ?? null;
    const storeName = store?.name;

    // Get Supabase client
    const supabase = getSupabaseServiceClient();

    // Generate report with employee data, store name, and month range
    const { products, metadata } = await generateSalesComparisonReport(
      supabase,
      employeeId,
      employeeName,
      year,
      storeId,
      storeName,
      startMonth,
      endMonth,
      employeeCode,
      phone,
      region,
      regularDayOff
    );

    // Handle different formats
    if (format === 'json') {
      const response: SalesComparisonResponse = {
        success: true,
        data: {
          products,
          metadata,
          branding,
        },
      };

      return NextResponse.json(response);
    }

    // TODO: Implement XLSX and CSV export
    if (format === 'xlsx') {
      return NextResponse.json(
        {
          success: false,
          error: 'XLSX export not implemented yet',
        } as SalesComparisonResponse,
        { status: 501 }
      );
    }

    if (format === 'csv') {
      return NextResponse.json(
        {
          success: false,
          error: 'CSV export not implemented yet',
        } as SalesComparisonResponse,
        { status: 501 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid format parameter',
      } as SalesComparisonResponse,
      { status: 400 }
    );
  } catch (error) {
    console.error('[sales-comparison] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error',
      } as SalesComparisonResponse,
      { status: 500 }
    );
  }
}
