"use client";

export default function LoadingDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 md:p-8">
      <div className="max-w-[1920px] mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8 animate-pulse">
          <div className="h-12 w-96 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-xl mb-3"></div>
          <div className="h-5 w-64 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
        </div>

        {/* Control Bar Skeleton */}
        <div className="flex flex-wrap gap-3 mb-8 animate-pulse">
          <div className="h-11 w-32 bg-white dark:bg-slate-800 rounded-lg shadow-sm"></div>
          <div className="h-11 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-sm"></div>
          <div className="h-11 w-36 bg-white dark:bg-slate-800 rounded-lg shadow-sm"></div>
          <div className="h-11 w-28 bg-white dark:bg-slate-800 rounded-lg shadow-sm"></div>
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="relative overflow-hidden">
              <div className="h-36 bg-white dark:bg-slate-800 rounded-2xl shadow-sm animate-pulse">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="relative overflow-hidden">
              <div className="h-[400px] bg-white dark:bg-slate-800 rounded-2xl shadow-sm animate-pulse">
                <div className="p-6">
                  <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg mb-4"></div>
                  <div className="h-[320px] bg-slate-100 dark:bg-slate-700/50 rounded-xl"></div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-shimmer"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 animate-pulse">
          <div className="h-6 w-64 bg-slate-200 dark:bg-slate-700 rounded-lg mb-6"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700/50 rounded-lg"></div>
                <div className="w-24 h-5 bg-slate-100 dark:bg-slate-700/50 rounded-lg"></div>
                <div className="w-20 h-5 bg-slate-100 dark:bg-slate-700/50 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}