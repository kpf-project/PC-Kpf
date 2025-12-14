import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabaseClient';
import { reverseGeocode } from '@/lib/geocoding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/geocoding/process
 *
 * Background endpoint to process pending geocoding jobs from the queue.
 * Can be triggered by:
 * - Cron job (recommended: every 5 minutes)
 * - Manual admin trigger
 * - Webhook after attendance record creation
 *
 * Query Parameters:
 * - batch_size: Number of jobs to process in this batch (default: 10, max: 50)
 *
 * Returns:
 * {
 *   success: true,
 *   processed: 10,
 *   succeeded: 8,
 *   failed: 2,
 *   details: [...job results]
 * }
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const batchSizeParam = url.searchParams.get('batch_size');
    const batchSize = Math.min(
      Math.max(1, parseInt(batchSizeParam || '10', 10)),
      50 // Max 50 jobs per batch
    );

    const supabase = getSupabaseServiceClient();

    // Get pending geocoding jobs (oldest first, with row locking)
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('geocoding_queue')
      .select('id, attendance_record_id, latitude, longitude, retry_count')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      console.error('[geocoding] failed to fetch pending jobs:', fetchError);
      return NextResponse.json(
        {
          success: false,
          error: 'ไม่สามารถดึงข้อมูล geocoding queue ได้',
          details: fetchError.message
        },
        { status: 500 }
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        succeeded: 0,
        failed: 0,
        message: 'ไม่มีงาน geocoding ที่รอดำเนินการ'
      });
    }

    console.log(`[geocoding] processing ${pendingJobs.length} jobs...`);

    // Process each job
    const results = await Promise.allSettled(
      pendingJobs.map(async (job) => {
        // Mark job as processing
        await supabase
          .from('geocoding_queue')
          .update({
            status: 'processing',
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        try {
          // Perform reverse geocoding (with rate limiting built into the function)
          const geocodeResult = await reverseGeocode(
            job.latitude,
            job.longitude
          );

          // Mark job as completed using RPC function
          const { error: completeError } = await supabase.rpc(
            'mark_geocoding_job_completed',
            {
              p_job_id: job.id,
              p_subdistrict: geocodeResult.subdistrict || '',
              p_district: geocodeResult.district || '',
              p_province: geocodeResult.province || '',
              p_full_address: geocodeResult.fullAddress || undefined
            }
          );

          if (completeError) {
            console.error(`[geocoding] failed to mark job ${job.id} as completed:`, completeError);
            throw new Error(completeError.message);
          }

          console.log(`[geocoding] ✅ job ${job.id} completed successfully`);

          return {
            jobId: job.id,
            attendanceRecordId: job.attendance_record_id,
            status: 'success',
            address: {
              subdistrict: geocodeResult.subdistrict,
              district: geocodeResult.district,
              province: geocodeResult.province
            }
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[geocoding] ❌ job ${job.id} failed:`, errorMessage);

          // Mark job as failed using RPC function (with retry logic)
          await supabase.rpc('mark_geocoding_job_failed', {
            p_job_id: job.id,
            p_error_message: errorMessage
          });

          return {
            jobId: job.id,
            attendanceRecordId: job.attendance_record_id,
            status: 'failed',
            error: errorMessage,
            retryCount: job.retry_count + 1
          };
        }
      })
    );

    // Count successes and failures
    const succeeded = results.filter(
      r => r.status === 'fulfilled' && r.value.status === 'success'
    ).length;
    const failed = results.length - succeeded;

    // Extract details
    const details = results.map(r =>
      r.status === 'fulfilled' ? r.value : { status: 'error', error: r.reason }
    );

    console.log(`[geocoding] batch complete: ${succeeded} succeeded, ${failed} failed`);

    return NextResponse.json({
      success: true,
      processed: results.length,
      succeeded,
      failed,
      details
    });

  } catch (error) {
    console.error('[geocoding] process endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการประมวลผล geocoding',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/geocoding/process
 *
 * Returns queue statistics (for monitoring)
 */
export async function GET() {
  try {
    const supabase = getSupabaseServiceClient();

    // Get queue statistics
    const { data: stats, error: statsError } = await supabase
      .from('geocoding_queue')
      .select('status')
      .then(result => {
        if (result.error) throw result.error;

        const data = result.data || [];
        const statusCounts = data.reduce((acc, row) => {
          acc[row.status] = (acc[row.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return {
          data: {
            total: data.length,
            pending: statusCounts.pending || 0,
            processing: statusCounts.processing || 0,
            completed: statusCounts.completed || 0,
            failed: statusCounts.failed || 0
          },
          error: null
        };
      });

    if (statsError) {
      throw statsError;
    }

    return NextResponse.json({
      success: true,
      queue: stats
    });

  } catch (error) {
    console.error('[geocoding] stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'ไม่สามารถดึงสถิติ geocoding queue ได้',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
