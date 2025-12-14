import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabaseClient";

/**
 * Batch endpoint to fetch store assignments for multiple employees at once
 * Solves N+1 query problem by fetching all assignments in a single database query
 *
 * POST /api/admin/employees/assignments/batch
 * Body: { employeeIds: string[] }
 * Returns: { assignments: Record<string, Assignment[]> }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeIds } = body;

    // Validate input
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ assignments: {} });
    }

    const supabase = getSupabaseServiceClient();

    // ✅ Single query with JOIN - fetches all assignments at once
    const { data, error } = await supabase
      .from('employee_store_assignments')
      .select(`
        id,
        employee_id,
        store_id,
        is_primary,
        created_at,
        updated_at,
        stores:store_id (
          id,
          name
        )
      `)
      .in('employee_id', employeeIds)
      .order('is_primary', { ascending: false }); // Primary stores first

    if (error) {
      console.error('[Batch API] Error fetching assignments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch assignments' },
        { status: 500 }
      );
    }

    // Group assignments by employee_id
    const assignmentMap: Record<string, Array<{
      id: string;
      employeeId: string;
      storeId: string;
      storeName: string;
      isPrimary: boolean;
      createdAt: string;
      updatedAt: string;
    }>> = {};

    for (const row of data || []) {
      const employeeId = row.employee_id;

      if (!assignmentMap[employeeId]) {
        assignmentMap[employeeId] = [];
      }

      assignmentMap[employeeId].push({
        id: row.id,
        employeeId: row.employee_id,
        storeId: row.store_id,
        storeName: (row.stores as { name: string } | null)?.name || '',
        isPrimary: row.is_primary,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }

    return NextResponse.json({
      success: true,
      assignments: assignmentMap
    });

  } catch (error) {
    console.error('[Batch API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
