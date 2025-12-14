/**
 * Supabase Backup System
 *
 * Production-ready backup solution using Supabase Storage and database
 * - Type-safe operations with full TypeScript support
 * - Automatic retention policies
 * - Integrity verification with SHA-256 hashing
 * - Support for manual, automatic, and scheduled backups
 */

import { createHash } from 'crypto';
import { getSupabaseServiceClient } from './supabaseClient';
import type { Database } from '@/types/supabase';
import * as supabaseLogs from './supabaseLogs';

// =============================================
// Type Definitions
// =============================================

type BackupSnapshotRow = Database['public']['Tables']['backup_snapshots']['Row'];
type BackupSnapshotInsert = Database['public']['Tables']['backup_snapshots']['Insert'];

export type BackupType = 'manual' | 'automatic' | 'scheduled';

export interface BackupMetadata {
  snapshotName: string;
  snapshotType: BackupType;
  description?: string;
  tags?: string[];
  createdBy?: string;
  expiresAt?: string; // ISO timestamp
}

export interface BackupSnapshot extends BackupSnapshotRow {
  sizeFormatted: string;
  ageFormatted: string;
}

export interface BackupListOptions {
  type?: BackupType;
  limit?: number;
  includeExpired?: boolean;
}

export interface CreateBackupOptions {
  type: BackupType;
  description?: string;
  tags?: string[];
  createdBy?: string;
  expiresInDays?: number;
}

export interface BackupStats {
  totalBackups: number;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  byType: {
    manual: number;
    automatic: number;
    scheduled: number;
  };
  oldestBackup: string | null;
  newestBackup: string | null;
}

// =============================================
// Constants
// =============================================

const BACKUP_BUCKET = 'backups';
const MAX_BACKUP_SIZE_MB = 50; // Maximum backup size in MB

// Retention limits per backup type
const RETENTION_LIMITS = {
  automatic: 20,
  manual: 50,
  scheduled: 100,
} as const;

// =============================================
// Helper Functions
// =============================================

/**
 * Generate SHA-256 hash for data integrity verification
 */
function generateHash(data: unknown): string {
  const json = JSON.stringify(data);
  return createHash('sha256').update(json).digest('hex');
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format age of backup (e.g., "2 hours ago", "3 days ago")
 */
function formatAge(timestamp: string): string {
  const now = new Date();
  const created = new Date(timestamp);
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

/**
 * Generate unique snapshot name with timestamp
 */
function generateSnapshotName(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `backup-${timestamp}`;
}

/**
 * Validate backup size
 */
function validateBackupSize(data: unknown): void {
  const json = JSON.stringify(data);
  const sizeBytes = Buffer.byteLength(json, 'utf8');
  const sizeMB = sizeBytes / (1024 * 1024);

  if (sizeMB > MAX_BACKUP_SIZE_MB) {
    throw new Error(
      `Backup size (${sizeMB.toFixed(2)} MB) exceeds maximum allowed size (${MAX_BACKUP_SIZE_MB} MB)`
    );
  }
}

// =============================================
// Core Backup Functions
// =============================================

/**
 * Create a new backup snapshot
 *
 * @param data - Data to backup (will be serialized to JSON)
 * @param options - Backup configuration options
 * @returns Created backup snapshot with metadata
 */
export async function createBackup(
  data: unknown,
  options: CreateBackupOptions
): Promise<BackupSnapshot> {
  const supabase = getSupabaseServiceClient();

  // Validate backup size
  validateBackupSize(data);

  // Generate snapshot metadata
  const snapshotName = generateSnapshotName();
  const dataJson = JSON.stringify(data);
  const sizeBytes = Buffer.byteLength(dataJson, 'utf8');
  const hash = generateHash(data);

  // Calculate expiration date if specified
  let expiresAt: string | null = null;
  if (options.expiresInDays && options.expiresInDays > 0) {
    const expires = new Date();
    expires.setDate(expires.getDate() + options.expiresInDays);
    expiresAt = expires.toISOString();
  }

  // Storage path in bucket
  const storagePath = `snapshots/${snapshotName}.json`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BACKUP_BUCKET)
    .upload(storagePath, dataJson, {
      contentType: 'application/json',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload backup to storage: ${uploadError.message}`);
  }

  // Insert backup record into database
  const insertData: BackupSnapshotInsert = {
    snapshot_name: snapshotName,
    snapshot_type: options.type,
    storage_path: storagePath,
    storage_bucket: BACKUP_BUCKET,
    data_snapshot: data as Database['public']['Tables']['backup_snapshots']['Insert']['data_snapshot'],
    snapshot_size_bytes: sizeBytes,
    snapshot_hash: hash,
    created_by: options.createdBy ?? null,
    description: options.description ?? null,
    tags: options.tags ?? null,
    expires_at: expiresAt,
  };

  const { data: snapshot, error: insertError } = await supabase
    .from('backup_snapshots')
    .insert(insertData)
    .select()
    .single();

  if (insertError) {
    // Cleanup storage if database insert fails
    await supabase.storage.from(BACKUP_BUCKET).remove([storagePath]);
    throw new Error(`Failed to save backup metadata: ${insertError.message}`);
  }

  // Log the backup creation
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: 'system',
    action: 'create',
    details: `สร้างสำรองข้อมูล: ${snapshotName} (${formatBytes(sizeBytes)})`,
    metadata: {
      snapshotName,
      type: options.type,
      sizeBytes,
      description: options.description,
    },
  });

  // Enforce retention policy
  await enforceRetentionPolicy();

  return {
    ...snapshot,
    sizeFormatted: formatBytes(snapshot.snapshot_size_bytes),
    ageFormatted: formatAge(snapshot.created_at),
  };
}

/**
 * List all backup snapshots with optional filtering
 *
 * @param options - Filtering and pagination options
 * @returns Array of backup snapshots sorted by creation date (newest first)
 */
export async function listBackups(options: BackupListOptions = {}): Promise<BackupSnapshot[]> {
  const supabase = getSupabaseServiceClient();

  let query = supabase
    .from('backup_snapshots')
    .select('*')
    .order('created_at', { ascending: false });

  // Filter by type if specified
  if (options.type) {
    query = query.eq('snapshot_type', options.type);
  }

  // Exclude expired backups unless explicitly requested
  if (!options.includeExpired) {
    query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
  }

  // Apply limit if specified
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list backups: ${error.message}`);
  }

  return (data ?? []).map((snapshot) => ({
    ...snapshot,
    sizeFormatted: formatBytes(snapshot.snapshot_size_bytes),
    ageFormatted: formatAge(snapshot.created_at),
  }));
}

/**
 * Get a specific backup snapshot by name
 *
 * @param snapshotName - Unique snapshot identifier
 * @returns Backup snapshot or null if not found
 */
export async function getBackup(snapshotName: string): Promise<BackupSnapshot | null> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from('backup_snapshots')
    .select('*')
    .eq('snapshot_name', snapshotName)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to get backup: ${error.message}`);
  }

  return {
    ...data,
    sizeFormatted: formatBytes(data.snapshot_size_bytes),
    ageFormatted: formatAge(data.created_at),
  };
}

/**
 * Restore data from a backup snapshot
 *
 * @param snapshotName - Unique snapshot identifier
 * @returns Restored data with integrity verification
 */
export async function restoreBackup<T = unknown>(snapshotName: string): Promise<T> {
  const supabase = getSupabaseServiceClient();

  // Get backup metadata
  const backup = await getBackup(snapshotName);
  if (!backup) {
    throw new Error(`Backup not found: ${snapshotName}`);
  }

  // Download from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(BACKUP_BUCKET)
    .download(backup.storage_path);

  if (downloadError) {
    throw new Error(`Failed to download backup: ${downloadError.message}`);
  }

  // Parse JSON data
  const text = await fileData.text();
  const restoredData = JSON.parse(text) as T;

  // Verify integrity with hash
  const calculatedHash = generateHash(restoredData);
  if (backup.snapshot_hash && calculatedHash !== backup.snapshot_hash) {
    throw new Error('Backup integrity verification failed: hash mismatch');
  }

  // Update restore tracking
  await supabase
    .from('backup_snapshots')
    .update({
      last_restored_at: new Date().toISOString(),
      restore_count: backup.restore_count + 1,
    })
    .eq('snapshot_name', snapshotName);

  // Log the restore
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: 'system',
    action: 'restore',
    details: `กู้คืนข้อมูลจาก: ${snapshotName}`,
    metadata: {
      snapshotName,
      sizeBytes: backup.snapshot_size_bytes,
      restoreCount: backup.restore_count + 1,
    },
  });

  return restoredData;
}

/**
 * Delete a backup snapshot (removes from both storage and database)
 *
 * @param snapshotName - Unique snapshot identifier
 * @returns True if deleted successfully
 */
export async function deleteBackup(snapshotName: string): Promise<boolean> {
  const supabase = getSupabaseServiceClient();

  // Get backup metadata
  const backup = await getBackup(snapshotName);
  if (!backup) {
    return false;
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(BACKUP_BUCKET)
    .remove([backup.storage_path]);

  if (storageError) {
    console.error('[Backup] Failed to delete from storage:', storageError);
  }

  // Delete from database
  const { error: deleteError } = await supabase
    .from('backup_snapshots')
    .delete()
    .eq('snapshot_name', snapshotName);

  if (deleteError) {
    throw new Error(`Failed to delete backup: ${deleteError.message}`);
  }

  // Log the deletion
  await supabaseLogs.addLog({
    timestamp: new Date().toISOString(),
    scope: 'system',
    action: 'delete',
    details: `ลบสำรองข้อมูล: ${snapshotName}`,
    metadata: { snapshotName, sizeBytes: backup.snapshot_size_bytes },
  });

  return true;
}

/**
 * Get backup statistics and summary
 *
 * @returns Aggregate statistics about all backups
 */
export async function getBackupStats(): Promise<BackupStats> {
  const supabase = getSupabaseServiceClient();

  const { data: backups, error } = await supabase
    .from('backup_snapshots')
    .select('snapshot_type, snapshot_size_bytes, created_at');

  if (error) {
    throw new Error(`Failed to get backup stats: ${error.message}`);
  }

  const totalBackups = backups?.length ?? 0;
  const totalSizeBytes = backups?.reduce((sum, b) => sum + b.snapshot_size_bytes, 0) ?? 0;

  const byType = {
    manual: backups?.filter((b) => b.snapshot_type === 'manual').length ?? 0,
    automatic: backups?.filter((b) => b.snapshot_type === 'automatic').length ?? 0,
    scheduled: backups?.filter((b) => b.snapshot_type === 'scheduled').length ?? 0,
  };

  const sortedByDate = [...(backups ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return {
    totalBackups,
    totalSizeBytes,
    totalSizeFormatted: formatBytes(totalSizeBytes),
    byType,
    oldestBackup: sortedByDate[0]?.created_at ?? null,
    newestBackup: sortedByDate[sortedByDate.length - 1]?.created_at ?? null,
  };
}

/**
 * Enforce retention policy (delete old backups beyond limits)
 *
 * @returns Number of backups deleted per type
 */
export async function enforceRetentionPolicy(): Promise<{
  automatic: number;
  manual: number;
  scheduled: number;
}> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase.rpc('enforce_backup_retention', {
    max_automatic_backups: RETENTION_LIMITS.automatic,
    max_manual_backups: RETENTION_LIMITS.manual,
    max_scheduled_backups: RETENTION_LIMITS.scheduled,
  });

  if (error) {
    throw new Error(`Failed to enforce retention policy: ${error.message}`);
  }

  const result = data?.[0] ?? { deleted_automatic: 0, deleted_manual: 0, deleted_scheduled: 0 };

  return {
    automatic: result.deleted_automatic ?? 0,
    manual: result.deleted_manual ?? 0,
    scheduled: result.deleted_scheduled ?? 0,
  };
}

/**
 * Cleanup expired backups
 *
 * @returns Number of expired backups removed
 */
export async function cleanupExpiredBackups(): Promise<number> {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase.rpc('cleanup_expired_backups');

  if (error) {
    throw new Error(`Failed to cleanup expired backups: ${error.message}`);
  }

  return data ?? 0;
}

// =============================================
// Convenience Functions
// =============================================

/**
 * Create an automatic backup (triggered by system events)
 */
export async function createAutomaticBackup(data: unknown): Promise<BackupSnapshot> {
  return createBackup(data, {
    type: 'automatic',
    description: 'Automatic backup on data change',
    expiresInDays: 7, // Auto backups expire after 7 days
  });
}

/**
 * Create a manual backup (user-initiated)
 */
export async function createManualBackup(
  data: unknown,
  createdBy: string,
  description?: string
): Promise<BackupSnapshot> {
  return createBackup(data, {
    type: 'manual',
    description: description ?? 'Manual backup',
    createdBy,
    expiresInDays: 30, // Manual backups expire after 30 days
  });
}

/**
 * Create a scheduled backup (cron job)
 */
export async function createScheduledBackup(data: unknown): Promise<BackupSnapshot> {
  return createBackup(data, {
    type: 'scheduled',
    description: 'Scheduled backup',
    tags: ['scheduled', 'cron'],
    expiresInDays: 90, // Scheduled backups expire after 90 days
  });
}

/**
 * Trigger automatic backup after data changes
 *
 * This function should be called after critical data operations (CREATE, UPDATE, DELETE)
 * on tables: employees, stores, products, categories
 *
 * Usage:
 * ```typescript
 * await triggerAutomaticBackup('employee', 'create', 'John Doe');
 * ```
 *
 * @param entity - Type of data changed (e.g., 'employee', 'store', 'product', 'category')
 * @param action - Action performed (e.g., 'create', 'update', 'delete')
 * @param identifier - Identifier for the changed data (e.g., employee name, product code)
 */
export async function triggerAutomaticBackup(
  entity: 'employee' | 'store' | 'product' | 'category',
  action: 'create' | 'update' | 'delete',
  identifier: string
): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();

    // Fetch current snapshot of all critical data
    const [
      { data: employees },
      { data: stores },
      { data: products },
      { data: categories },
    ] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('stores').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
    ]);

    const snapshot = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      trigger: {
        entity,
        action,
        identifier,
      },
      data: {
        employees: employees ?? [],
        stores: stores ?? [],
        products: products ?? [],
        categories: categories ?? [],
      },
      metadata: {
        employeesCount: employees?.length ?? 0,
        storesCount: stores?.length ?? 0,
        productsCount: products?.length ?? 0,
        categoriesCount: categories?.length ?? 0,
      },
    };

    // Create automatic backup (fires async, doesn't block response)
    await createAutomaticBackup(snapshot);

    console.log(`[Automatic Backup] Created backup after ${action} ${entity}: ${identifier}`);
  } catch (error) {
    // Log error but don't throw - backup failure shouldn't block main operation
    console.error('[Automatic Backup] Failed to create backup:', error);
  }
}
