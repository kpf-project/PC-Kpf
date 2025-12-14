'use client';

/**
 * Backup Management Client
 *
 * Admin UI for managing production backups
 * - Create manual backups
 * - View backup history
 * - Restore from backups
 * - Monitor backup statistics
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  HardDrive,
  RefreshCw,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  TrendingUp,
  Server,
  Lock,
  User,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import PINKeypad from '@/components/PINKeypad';

// =============================================
// Types
// =============================================

interface BackupSnapshot {
  id: string;
  snapshot_name: string;
  snapshot_type: 'manual' | 'automatic' | 'scheduled';
  snapshot_size_bytes: number;
  created_at: string;
  created_by: string | null;
  description: string | null;
  restore_count: number;
  last_restored_at: string | null;
  sizeFormatted: string;
  ageFormatted: string;
  expires_at: string | null;
}

interface BackupStats {
  totalBackups: number;
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
// Component
// =============================================

export default function BackupManagementClient() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();

  // All hooks must be called before any conditional returns
  const [selectedBackup, setSelectedBackup] = useState<BackupSnapshot | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [backupDescription, setBackupDescription] = useState('');
  const [showPINVerification, setShowPINVerification] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPIN, setIsVerifyingPIN] = useState(false);

  // =============================================
  // Queries (must be called before conditional returns)
  // =============================================

  const { data: backups = [], isLoading: loadingBackups, refetch: refetchBackups } = useQuery({
    queryKey: ['backups-v2'],
    queryFn: async () => {
      const res = await fetch('/api/admin/backups/v2');
      if (!res.ok) throw new Error('Failed to fetch backups');
      const json = await res.json();
      return json.data as BackupSnapshot[];
    },
    staleTime: 60000, // Cache for 1 minute (instead of auto-refresh every 30 seconds)
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['backup-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/backups/v2?action=stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const json = await res.json();
      return json.data as BackupStats;
    },
    staleTime: 60000, // Cache for 1 minute (instead of auto-refresh every 30 seconds)
  });

  // =============================================
  // Mutations (must be called before conditional returns)
  // =============================================

  const createBackupMutation = useMutation({
    mutationFn: async (description: string) => {
      const res = await fetch('/api/admin/backups/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          createdBy: user?.employeeName ?? 'Admin',
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create backup');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups-v2'] });
      queryClient.invalidateQueries({ queryKey: ['backup-stats'] });
      setBackupDescription('');
      alert('✅ สร้างสำรองข้อมูลสำเร็จ');
    },
    onError: (error) => {
      alert(`❌ เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async (snapshotName: string) => {
      const res = await fetch('/api/admin/backups/v2/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshotName,
          restoredBy: user?.employeeName ?? 'Admin',
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to restore backup');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups-v2'] });
      setShowRestoreConfirm(false);
      setSelectedBackup(null);
      alert('✅ กู้คืนข้อมูลสำเร็จ');
    },
    onError: (error) => {
      alert(`❌ เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: async (snapshotName: string) => {
      const res = await fetch(`/api/admin/backups/v2?name=${snapshotName}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete backup');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups-v2'] });
      queryClient.invalidateQueries({ queryKey: ['backup-stats'] });
      setShowDeleteConfirm(false);
      setSelectedBackup(null);
      alert('✅ ลบสำรองข้อมูลสำเร็จ');
    },
    onError: (error) => {
      alert(`❌ เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // =============================================
  // Handlers
  // =============================================

  // Check if user is super_admin (after all hooks are called)
  if (!user || !hasRole(['super_admin'])) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 rounded-full bg-red-100 p-4 inline-block">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-sm text-slate-600">เฉพาะ Super Admin เท่านั้นที่สามารถเข้าถึงหน้านี้ได้</p>
        </div>
      </div>
    );
  }

  const handleCreateBackup = () => {
    if (!backupDescription.trim()) {
      alert('กรุณาใส่คำอธิบายสำหรับสำรองข้อมูล');
      return;
    }
    createBackupMutation.mutate(backupDescription);
  };

  const handleRestoreClick = () => {
    if (!selectedBackup) return;
    // Show PIN verification first
    setShowRestoreConfirm(false);
    setShowPINVerification(true);
  };

  const handlePINVerification = async (pin: string) => {
    if (!selectedBackup) return;

    setIsVerifyingPIN(true);
    setPinError(null);

    try {
      // Verify PIN by attempting login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const result = await response.json();

      if (!result.success) {
        setPinError(result.message || 'รหัส PIN ไม่ถูกต้อง');
        setIsVerifyingPIN(false);
        return;
      }

      // PIN verified, proceed with restore
      setShowPINVerification(false);
      restoreBackupMutation.mutate(selectedBackup.snapshot_name);
    } catch (error) {
      setPinError('เกิดข้อผิดพลาดในการตรวจสอบรหัส PIN');
      setIsVerifyingPIN(false);
    }
  };

  const handleDelete = () => {
    if (!selectedBackup) return;
    deleteBackupMutation.mutate(selectedBackup.snapshot_name);
  };

  // =============================================
  // Render
  // =============================================

  const _getTypeColor = (type: string) => {
    switch (type) {
      case 'manual':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'automatic':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'scheduled':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'manual':
        return 'Manual';
      case 'automatic':
        return 'Auto';
      case 'scheduled':
        return 'Scheduled';
      default:
        return type;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 -m-6">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
              System Backups
            </h1>
            <p className="text-slate-400 flex items-center gap-2">
              <Server className="h-4 w-4 text-cyan-500" />
              Secure Data Management Center
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                refetchBackups();
                refetchStats();
              }}
              disabled={loadingBackups}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                loadingBackups
                  ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-95'
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${loadingBackups ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">Refresh</span>
            </button>

            <div className="px-4 py-2 rounded-full bg-slate-900/50 border border-slate-800 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">System Active</span>
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <div className="group relative overflow-hidden rounded-2xl bg-slate-900/50 border border-slate-800 p-5 backdrop-blur-sm transition-all hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                    <Database className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Backups</span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stats.totalBackups}</div>
                <div className="text-xs text-cyan-400/80 font-mono">{stats.totalSizeFormatted}</div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-slate-900/50 border border-slate-800 p-5 backdrop-blur-sm transition-all hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Manual</span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stats.byType.manual}</div>
                <div className="text-xs text-emerald-400/80">User Initiated</div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-slate-900/50 border border-slate-800 p-5 backdrop-blur-sm transition-all hover:border-violet-500/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 group-hover:scale-110 transition-transform">
                    <Clock className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Scheduled</span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stats.byType.scheduled}</div>
                <div className="text-xs text-violet-400/80">Automated</div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-slate-900/50 border border-slate-800 p-5 backdrop-blur-sm transition-all hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Auto-Save</span>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{stats.byType.automatic}</div>
                <div className="text-xs text-amber-400/80">System Events</div>
              </div>
            </div>
          </div>
        )}

        {/* Create Backup Section */}
        <section className="relative overflow-hidden rounded-2xl bg-slate-900/80 border border-slate-700 p-8 backdrop-blur-md shadow-xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
              <HardDrive className="h-8 w-8 text-cyan-400" />
            </div>

            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold text-white mb-2">Create Manual Snapshot</h2>
              <p className="text-slate-400 text-sm">Capture the current system state instantly. Useful before major updates or maintenance.</p>
            </div>

            <div className="flex-1 w-full md:w-auto flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Enter backup description..."
                className="flex-1 bg-slate-950/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all"
                value={backupDescription}
                onChange={(e) => setBackupDescription(e.target.value)}
                disabled={createBackupMutation.isPending}
              />
              <button
                onClick={handleCreateBackup}
                disabled={createBackupMutation.isPending || !backupDescription.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 !text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {createBackupMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4" />
                    Create Snapshot
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Backup List */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-slate-400" />
              Snapshot History
            </h2>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['backups-v2'] })}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors"
              disabled={loadingBackups}
            >
              <RefreshCw className={`h-5 w-5 ${loadingBackups ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingBackups ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-cyan-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
                </div>
              </div>
              <p className="text-slate-500 mt-4 text-sm animate-pulse">Loading snapshots...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 mx-auto bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <Server className="h-10 w-10 text-slate-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-300">No Snapshots Found</h3>
              <p className="text-slate-500 text-sm mt-1">System is waiting for the first backup.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="group p-4 sm:p-6 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${backup.snapshot_type === 'manual'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : backup.snapshot_type === 'scheduled'
                              ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${backup.snapshot_type === 'manual' ? 'bg-emerald-400' :
                            backup.snapshot_type === 'scheduled' ? 'bg-violet-400' : 'bg-amber-400'
                            }`} />
                          {getTypeLabel(backup.snapshot_type)}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">{backup.ageFormatted}</span>
                      </div>

                      <h3 className="font-mono text-sm font-bold text-cyan-100 mb-1 truncate group-hover:text-cyan-400 transition-colors">
                        {backup.snapshot_name}
                      </h3>

                      {backup.description && (
                        <p className="text-sm text-slate-400 mb-3 line-clamp-1">{backup.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5 bg-slate-900/50 px-2 py-1 rounded border border-slate-800">
                          <HardDrive className="h-3 w-3 text-slate-400" />
                          {backup.sizeFormatted}
                        </span>
                        {backup.created_by && (
                          <span className="flex items-center gap-1.5">
                            <User className="h-3 w-3" />
                            {backup.created_by}
                          </span>
                        )}
                        {backup.restore_count > 0 && (
                          <span className="flex items-center gap-1.5 text-cyan-500/80">
                            <RefreshCw className="h-3 w-3" />
                            Restored {backup.restore_count}x
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setSelectedBackup(backup);
                          setShowRestoreConfirm(true);
                        }}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-slate-800 hover:bg-cyan-900/30 !text-white border border-slate-700 hover:border-cyan-500/30 transition-all text-xs font-medium flex items-center justify-center gap-2"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Restore
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBackup(backup);
                          setShowDeleteConfirm(true);
                        }}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-slate-800 hover:bg-rose-900/30 !text-white border border-slate-700 hover:border-rose-500/30 transition-all text-xs font-medium flex items-center justify-center gap-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && selectedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-slate-900 p-6 shadow-2xl shadow-amber-900/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-full bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">System Restore</h3>
                <p className="text-xs text-amber-500/80">Critical Action Required</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Are you sure you want to restore the system to this state? Current data will be overwritten.
            </p>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-cyan-500" />
                <span className="font-mono text-sm font-bold text-cyan-100 truncate">
                  {selectedBackup.snapshot_name}
                </span>
              </div>
              <p className="text-xs text-slate-500 pl-6">{selectedBackup.description || 'No description'}</p>
              <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between text-xs text-slate-500">
                <span>Size: {selectedBackup.sizeFormatted}</span>
                <span>{new Date(selectedBackup.created_at).toLocaleString('th-TH')}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRestoreConfirm(false);
                  setSelectedBackup(null);
                }}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreClick}
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-900/20 hover:from-amber-500 hover:to-orange-500 transition-all"
              >
                Proceed to Verify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Verification Modal */}
      {showPINVerification && selectedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl shadow-cyan-900/20">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto bg-cyan-500/10 rounded-full flex items-center justify-center mb-4 border border-cyan-500/20">
                <Lock className="h-8 w-8 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Security Verification</h3>
              <p className="text-sm text-slate-400 mt-1">Enter your PIN to authorize restoration</p>
            </div>

            <div className="mb-6">
              <PINKeypad
                minLength={4}
                maxLength={6}
                onSubmit={handlePINVerification}
                isLoading={isVerifyingPIN}
                error={pinError}
                onClear={() => setPinError(null)}
              />
            </div>

            <button
              onClick={() => {
                setShowPINVerification(false);
                setSelectedBackup(null);
                setPinError(null);
              }}
              disabled={isVerifyingPIN || restoreBackupMutation.isPending}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel Operation
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl shadow-rose-900/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-full bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-6 w-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Snapshot</h3>
                <p className="text-xs text-rose-500/80">Irreversible Action</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-6">
              This will permanently remove the snapshot <span className="text-white font-mono font-bold">{selectedBackup.snapshot_name}</span>. This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedBackup(null);
                }}
                disabled={deleteBackupMutation.isPending}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteBackupMutation.isPending}
                className="flex-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-900/20 hover:from-rose-500 hover:to-red-500 transition-all"
              >
                {deleteBackupMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
