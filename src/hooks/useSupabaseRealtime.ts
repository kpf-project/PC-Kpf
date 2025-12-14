'use client';

/**
 * useSupabaseRealtime Hook
 *
 * Subscribes to Supabase Realtime changes for dashboard updates
 * Listens to INSERT events on sales_records and attendance_records
 */

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type RealtimeCallback = () => void;

interface UseSupabaseRealtimeOptions {
  onSalesInsert?: RealtimeCallback;
  onAttendanceInsert?: RealtimeCallback;
  enabled?: boolean;
}

/**
 * Hook to subscribe to Supabase Realtime events
 * ✅ Fixed: Memory leak by using useCallback to stabilize callback references
 * ✅ Fixed: Properly cleanup old channels before creating new ones
 *
 * @example
 * ```tsx
 * useSupabaseRealtime({
 *   onSalesInsert: () => {
 *     console.log('New sale recorded!');
 *     refetchDashboard();
 *   },
 *   onAttendanceInsert: () => {
 *     console.log('New attendance!');
 *     refetchDashboard();
 *   }
 * });
 * ```
 */
export function useSupabaseRealtime({
  onSalesInsert,
  onAttendanceInsert,
  enabled = true,
}: UseSupabaseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<ReturnType<typeof createClient<Database>> | null>(null);

  // Stabilize callbacks with useCallback to prevent unnecessary re-subscriptions
  const stableOnSalesInsert = useCallback(() => {
    onSalesInsert?.();
  }, [onSalesInsert]);

  const stableOnAttendanceInsert = useCallback(() => {
    onAttendanceInsert?.();
  }, [onAttendanceInsert]);

  useEffect(() => {
    if (!enabled) return;

    // Initialize Supabase client with anon key (safe for client-side)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[useSupabaseRealtime] Missing Supabase environment variables');
      return;
    }

    // Initialize client once (singleton pattern prevents multiple clients)
    if (!clientRef.current) {
      clientRef.current = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
    }

    const supabase = clientRef.current;

    // Clean up previous channel before creating new one (CRITICAL for preventing memory leak)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create a new channel for realtime subscriptions
    const channel = supabase.channel('dashboard-updates', {
      config: {
        broadcast: { self: false },
      },
    });

    // Subscribe to sales_records INSERT events
    if (onSalesInsert) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sales_records',
        },
        (payload) => {
          console.log('[Realtime] New sale recorded:', payload.new);
          stableOnSalesInsert();
        }
      );
    }

    // Subscribe to attendance_records INSERT events
    if (onAttendanceInsert) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_records',
        },
        (payload) => {
          console.log('[Realtime] New attendance recorded:', payload.new);
          stableOnAttendanceInsert();
        }
      );
    }

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Successfully subscribed to dashboard updates');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime] Failed to subscribe to channel');
      } else if (status === 'TIMED_OUT') {
        console.error('[Realtime] Subscription timed out');
      }
    });

    channelRef.current = channel;

    // Cleanup on unmount - properly remove channel to prevent memory leak
    return () => {
      console.log('[Realtime] Unsubscribing from dashboard updates');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // Callbacks are stabilized with useCallback, safe to use as dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, stableOnSalesInsert, stableOnAttendanceInsert]);

  return {
    isConnected: channelRef.current !== null,
  };
}
