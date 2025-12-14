'use client';

/**
 * User PINs Management Client Component
 * Admin interface for managing user authentication PINs
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, Key, Shield, User, CheckCircle, XCircle, RotateCcw, AlertTriangle, Search, Lock } from 'lucide-react';
import type { Database } from '@/types/supabase';

type UserPin = Database['public']['Tables']['user_pins']['Row'];
type UserRole = 'employee' | 'sales' | 'admin' | 'super_admin';

// Type for update requests (includes 'pin' field for API, not 'pin_hash')
type UpdateUserPinData = Partial<Omit<UserPin, 'pin_hash'>> & { pin?: string };

export default function UserPinsClient() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPin, setEditingPin] = useState<UserPin | null>(null);
  const [deletingPin, setDeletingPin] = useState<UserPin | null>(null);
  const [resettingPin, setResettingPin] = useState<UserPin | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  // Fetch user PINs
  const { data: userPins, isLoading } = useQuery({
    queryKey: ['user-pins'],
    queryFn: async () => {
      const res = await fetch('/api/admin/user-pins');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      return data.userPins as UserPin[];
    },
  });

  // Filtered PINs
  const filteredPins = userPins?.filter(pin =>
    pin.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pin.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ... mutations remain the same ...
  // สร้าง PIN ใหม่ mutation
  const createMutation = useMutation({
    mutationFn: async (data: { employee_id: string; employee_name: string; pin: string; role: string }) => {
      const res = await fetch('/api/admin/user-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-pins'] });
      setIsCreateModalOpen(false);
    },
  });

  // Update PIN mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserPinData }) => {
      const res = await fetch(`/api/admin/user-pins/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-pins'] });
      setEditingPin(null);
    },
  });

  // Delete PIN mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/user-pins/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-pins'] });
      setDeletingPin(null);
    },
  });

  const hasPins = (userPins?.length ?? 0) > 0;

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      employee: 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]',
      sales: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
      admin: 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.2)]',
      super_admin: 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]',
    };
    const labels: Record<string, string> = {
      employee: 'Employee',
      sales: 'Sales',
      admin: 'Admin',
      super_admin: 'Super Admin',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold backdrop-blur-md ${colors[role] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
        <Shield className="h-3.5 w-3.5" />
        {labels[role] || role}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-500/30 border-t-blue-500"></div>
          <p className="text-sm font-medium text-blue-400 animate-pulse">Loading System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans selection:bg-cyan-500/30 overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/5 blur-[120px]" />
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-purple-600/5 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-400 mb-2 tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              ACCESS CONTROL
            </h1>
            <p className="text-slate-400 text-lg font-light flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              Secure PIN Management System
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all w-full md:w-64 backdrop-blur-sm"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsCreateModalOpen(true)}
              className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                <span>New PIN</span>
              </div>
            </motion.button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-all hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative flex items-center gap-4">
              <div className="rounded-xl bg-blue-500/10 p-3 text-blue-400 ring-1 ring-blue-500/20 transition-transform group-hover:scale-110 group-hover:text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                <User className="h-8 w-8" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{userPins?.length || 0}</p>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Total Users</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-all hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative flex items-center gap-4">
              <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400 ring-1 ring-emerald-500/20 transition-transform group-hover:scale-110 group-hover:text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">
                  {userPins?.filter(p => p.is_active).length || 0}
                </p>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Active Users</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm transition-all hover:border-rose-500/50 hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative flex items-center gap-4">
              <div className="rounded-xl bg-rose-500/10 p-3 text-rose-400 ring-1 ring-rose-500/20 transition-transform group-hover:scale-110 group-hover:text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                <XCircle className="h-8 w-8" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">
                  {userPins?.filter(p => !p.is_active).length || 0}
                </p>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Inactive Users</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Security Warning */}
        {/* <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              α╣Çα╕₧α╕╖α╣êα╕¡α╕äα╕ºα╕▓α╕íα╕¢α╕Ñα╕¡α╕öα╕áα╕▒α╕ó PIN α╕ûα╕╣α╕üα╣Çα╕éα╣ëα╕▓α╕úα╕½α╕▒α╕¬α╕öα╣ëα╕ºα╕ó bcrypt
            </p>
            <p className="mt-1 text-xs text-amber-700">
              α╣äα╕íα╣êα╕¬α╕▓α╕íα╕▓α╕úα╕ûα╣üα╕¬α╕öα╕ç PIN α╕êα╕úα╕┤α╕çα╣äα╕öα╣ë α╕½α╕▓α╕üα╕òα╣ëα╕¡α╕çα╕üα╕▓α╕úα╣Çα╕¢α╕Ñα╕╡α╣êα╕óα╕Ö PIN α╣âα╕èα╣ëα╕ƒα╕╡α╣Çα╕êα╕¡α╕úα╣î &quot;α╕úα╕╡α╣Çα╕ïα╣çα╕ò PIN&quot; α╕½α╕úα╕╖α╕¡α╣üα╕üα╣ëα╣äα╕éα╕£α╕╣α╣ëα╣âα╕èα╣ë
            </p>
          </div>
        </div> */}

        {/* Data Views */}
        <AnimatePresence mode="wait">
          {hasPins ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Mobile Grid View */}
              <div className="grid gap-4 md:hidden">
                <AnimatePresence>
                  {filteredPins?.map((pin, index) => (
                    <motion.div
                      key={pin.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-lg backdrop-blur-sm relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Shield className="w-24 h-24 text-slate-500" />
                      </div>

                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <p className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-1">ID: {pin.employee_id}</p>
                            <p className="text-xl font-bold text-white">{pin.employee_name}</p>
                          </div>
                          <div className="shrink-0">{getRoleBadge(pin.role)}</div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mb-6">
                          <button
                            onClick={() =>
                              updateMutation.mutate({
                                id: pin.id,
                                data: { is_active: !pin.is_active },
                              })
                            }
                            className={
                              pin.is_active
                                ? "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
                                : "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                            }
                          >
                            {pin.is_active ? (
                              <CheckCircle className="h-3.5 w-3.5" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            {pin.is_active ? 'Active' : 'Inactive'}
                          </button>
                          <button
                            onClick={() => setResettingPin(pin)}
                            disabled={pin.role === 'super_admin'}
                            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 transition-all hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                            title={pin.role === 'super_admin' ? 'Cannot reset Super Admin PIN' : 'Reset PIN'}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Reset PIN
                          </button>
                        </div>

                        <div className="rounded-xl bg-slate-950/50 border border-slate-800 p-4 text-sm mb-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-slate-500 flex items-center gap-2">
                              <Key className="w-3.5 h-3.5" /> Last Login
                            </span>
                            <span className="text-right font-mono text-slate-300">
                              {pin.last_login_at
                                ? new Date(pin.last_login_at).toLocaleString('th-TH')
                                : '-'}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => setEditingPin(pin)}
                            disabled={pin.role === 'super_admin'}
                            className="flex-1 rounded-xl bg-blue-600/10 border border-blue-600/20 px-4 py-3 text-sm font-bold text-blue-400 transition hover:bg-blue-600/20 hover:border-blue-600/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" /> Edit
                          </button>
                          <button
                            onClick={() => setDeletingPin(pin)}
                            disabled={pin.role === 'super_admin'}
                            className="flex-1 rounded-xl bg-red-600/10 border border-red-600/20 px-4 py-3 text-sm font-bold text-red-400 transition hover:bg-red-600/20 hover:border-red-600/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl backdrop-blur-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-950/50 border-b border-slate-800">
                        <tr>
                          <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Employee ID</th>
                          <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Name</th>
                          <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">PIN</th>
                          <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Role</th>
                          <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                          <th className="px-6 py-5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Last Login</th>
                          <th className="px-6 py-5 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        <AnimatePresence>
                          {filteredPins?.map((pin, index) => (
                            <motion.tr
                              key={pin.id}
                              layout
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ delay: index * 0.03 }}
                              className="group transition hover:bg-slate-800/30"
                            >
                              <td className="px-6 py-4 text-sm font-medium text-cyan-400 font-mono">
                                {pin.employee_id}
                              </td>
                              <td className="px-6 py-4 text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                                {pin.employee_name}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-sm text-slate-600 tracking-[0.3em] group-hover:text-slate-400 transition-colors">••••••</span>
                                  <button
                                    onClick={() => setResettingPin(pin)}
                                    disabled={pin.role === 'super_admin'}
                                    className="rounded-lg p-1.5 text-amber-500/50 transition hover:bg-amber-500/10 hover:text-amber-400 disabled:opacity-30"
                                    title="Reset PIN"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-6 py-4">{getRoleBadge(pin.role)}</td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => {
                                    updateMutation.mutate({
                                      id: pin.id,
                                      data: { is_active: !pin.is_active },
                                    });
                                  }}
                                  className={
                                    pin.is_active
                                      ? "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                                      : "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                                  }
                                >
                                  {pin.is_active ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                                  {pin.is_active ? 'Active' : 'Inactive'}
                                </button>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-400 font-mono">
                                {pin.last_login_at
                                  ? new Date(pin.last_login_at).toLocaleString('th-TH')
                                  : '-'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => setEditingPin(pin)}
                                    disabled={pin.role === 'super_admin'}
                                    className="rounded-lg p-2 text-blue-400 transition hover:bg-blue-500/10 hover:text-blue-300 disabled:opacity-50"
                                    title="Edit"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingPin(pin)}
                                    disabled={pin.role === 'super_admin'}
                                    className="rounded-lg p-2 text-red-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 p-16 text-center backdrop-blur-sm"
            >
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                <Key className="relative h-16 w-16 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No PINs Found</h3>
              <p className="text-slate-400 mb-6 max-w-xs mx-auto">
                Get started by creating a new PIN for an employee.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="rounded-xl bg-blue-600/20 border border-blue-500/30 px-6 py-3 font-bold text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 transition-all"
              >
                Create First PIN
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Modal */}
        <AnimatePresence>
          {isCreateModalOpen && (
            <CreatePINModal
              onClose={() => setIsCreateModalOpen(false)}
              onSubmit={(data) => createMutation.mutate(data)}
              isSubmitting={createMutation.isPending}
              error={createMutation.error?.message}
            />
          )}
        </AnimatePresence>

        {/* Edit Modal */}
        <AnimatePresence>
          {editingPin && (
            <EditPINModal
              pin={editingPin}
              onClose={() => setEditingPin(null)}
              onSubmit={(data) => updateMutation.mutate({ id: editingPin.id, data })}
              isSubmitting={updateMutation.isPending}
              error={updateMutation.error?.message}
            />
          )}
        </AnimatePresence>

        {/* Delete Confirm */}
        <AnimatePresence>
          {deletingPin && (
            <DeleteConfirmModal
              pin={deletingPin}
              onClose={() => setDeletingPin(null)}
              onConfirm={() => deleteMutation.mutate(deletingPin.id)}
              isDeleting={deleteMutation.isPending}
            />
          )}
        </AnimatePresence>

        {/* Reset PIN Modal */}
        <AnimatePresence>
          {resettingPin && (
            <ResetPINModal
              pin={resettingPin}
              onClose={() => setResettingPin(null)}
              onSubmit={(newPin) => {
                updateMutation.mutate({
                  id: resettingPin.id,
                  data: { pin: newPin },
                });
                setResettingPin(null);
              }}
              isSubmitting={updateMutation.isPending}
              error={updateMutation.error?.message}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Create PIN Modal Component
function CreatePINModal({
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  onClose: () => void;
  onSubmit: (data: { employee_id: string; employee_name: string; pin: string; role: string }) => void;
  isSubmitting: boolean;
  error?: string;
}) {
  const [formData, setFormData] = useState({
    employee_id: '',
    employee_name: '',
    pin: '',
    role: 'employee' as UserRole,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative overflow-hidden"
      >
        {/* Background Glow */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500" />

        <h2 className="mb-6 text-xl font-bold text-white flex items-center gap-2">
          <Plus className="w-5 h-5 text-cyan-400" />
          Create New PIN
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-400">Employee ID</label>
            <input
              type="text"
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
              required
              placeholder="e.g. EMP001"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-400">Name</label>
            <input
              type="text"
              value={formData.employee_name}
              onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
              required
              placeholder="Full Name"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-400">PIN (6 Digits)</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={formData.pin}
              onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-2xl tracking-[0.5em] text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all font-mono"
              required
              minLength={4}
              maxLength={6}
              placeholder="••••••"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-400">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
            >
              <option value="employee">Employee</option>
              <option value="sales">Sales</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs text-blue-400">
            <p className="font-bold mb-1 flex items-center gap-1"><Shield className="w-3 h-3" /> Security Note</p>
            <p className="opacity-80">PINs are securely hashed. They cannot be viewed after creation.</p>
          </div>
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-transparent px-4 py-3 font-bold text-slate-400 transition hover:bg-slate-800 hover:text-white"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 font-bold text-white transition hover:shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create PIN'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Edit PIN Modal Component
function EditPINModal({
  pin,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  pin: UserPin;
  onClose: () => void;
  onSubmit: (data: Partial<UserPin>) => void;
  isSubmitting: boolean;
  error?: string;
}) {
  const [formData, setFormData] = useState({
    employee_name: pin.employee_name,
    pin: '',
    role: pin.role as UserRole,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<UserPin> = {
      employee_name: formData.employee_name,
      role: formData.role,
    };
    if (formData.pin) {
      updates.pin_hash = formData.pin; // Will be hashed by API
    }
    onSubmit(updates);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative overflow-hidden"
      >
        {/* Background Glow */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" />

        <h2 className="mb-6 text-xl font-bold text-white flex items-center gap-2">
          <Edit2 className="w-5 h-5 text-blue-400" />
          Edit PIN
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-400">Employee ID</label>
            <input
              type="text"
              value={pin.employee_id}
              disabled
              className="w-full rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-slate-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-400">Name</label>
            <input
              type="text"
              value={formData.employee_name}
              onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-400">
              New PIN (Leave blank to keep current)
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={formData.pin}
              onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-2xl tracking-[0.5em] text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
              minLength={4}
              maxLength={6}
              placeholder="••••"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-400">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            >
              <option value="employee">Employee</option>
              <option value="sales">Sales</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-400">
            <p className="font-bold mb-1 flex items-center gap-1"><Shield className="w-3 h-3" /> Security Note</p>
            <p className="opacity-80">PINs are securely hashed. They cannot be viewed after creation.</p>
          </div>
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-transparent px-4 py-3 font-bold text-slate-400 transition hover:bg-slate-800 hover:text-white"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Reset PIN Modal Component
function ResetPINModal({
  pin,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  pin: UserPin;
  onClose: () => void;
  onSubmit: (newPin: string) => void;
  isSubmitting: boolean;
  error?: string;
}) {
  const [newPin, setNewPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length >= 4 && newPin.length <= 6) {
      onSubmit(newPin);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative overflow-hidden"
      >
        {/* Background Glow */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />

        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-full bg-amber-500/10 p-3 ring-1 ring-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <RotateCcw className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Reset PIN</h2>
            <p className="text-sm text-slate-400">
              {pin.employee_name} ({pin.employee_id})
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-400">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">Security Warning</p>
                <p className="opacity-80">
                  The old PIN is encrypted and cannot be recovered. You must set a new PIN.
                </p>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-400">
              New PIN (6 Digits)
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-2xl tracking-[0.5em] text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-mono"
              required
              minLength={4}
              maxLength={6}
              placeholder="••••"
              autoFocus
            />
            <p className="mt-2 text-xs text-slate-500 text-center">
              Entered {newPin.length}/6 digits
            </p>
          </div>
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-transparent px-4 py-3 font-bold text-slate-400 transition hover:bg-slate-800 hover:text-white"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-amber-600 px-4 py-3 font-bold text-white transition hover:bg-amber-500 disabled:opacity-50 shadow-lg shadow-amber-500/20"
              disabled={isSubmitting || newPin.length < 4}
            >
              {isSubmitting ? 'Resetting...' : 'Reset PIN'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// Delete Confirm Modal Component
function DeleteConfirmModal({
  pin,
  onClose,
  onConfirm,
  isDeleting,
}: {
  pin: UserPin;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative overflow-hidden"
      >
        {/* Background Glow */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-rose-500 to-red-500" />

        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-full bg-red-500/10 p-3 ring-1 ring-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <Trash2 className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Confirm Deletion</h2>
            <p className="text-sm text-slate-400">This action cannot be undone.</p>
          </div>
        </div>
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to delete PIN for{' '}
            <span className="font-bold text-white">{pin.employee_name}</span>{' '}
            ({pin.employee_id})?
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-700 bg-transparent px-4 py-3 font-bold text-slate-400 transition hover:bg-slate-800 hover:text-white"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-bold text-white transition hover:bg-red-500 disabled:opacity-50 shadow-lg shadow-red-500/20"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}




