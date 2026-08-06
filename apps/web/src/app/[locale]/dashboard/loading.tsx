export default function DashboardLoading() {
  return (
    <div className="space-y-8 px-4 sm:px-8 py-8 w-full mx-auto animate-in fade-in duration-300">
      {/* Header Skeleton */}
      <div className="space-y-3 mb-10">
        <div className="h-8 w-48 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
        <div className="h-4 w-80 bg-black/5 dark:bg-white/5 rounded-md animate-pulse" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-black/5 dark:border-white/5 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              <div className="h-9 w-9 bg-black/5 dark:bg-white/5 rounded-xl animate-pulse" />
            </div>
            <div className="h-8 w-20 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
            <div className="h-3 w-32 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 rounded-2xl border border-black/5 dark:border-white/5 p-6">
          <div className="h-5 w-36 bg-black/5 dark:bg-white/5 rounded animate-pulse mb-6" />
          <div className="h-[300px] bg-black/[0.03] dark:bg-white/[0.03] rounded-xl animate-pulse" />
        </div>
        <div className="rounded-2xl border border-black/5 dark:border-white/5 p-6 space-y-4">
          <div className="h-5 w-32 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-black/5 dark:border-white/5">
              <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-full bg-black/5 dark:bg-white/5 rounded animate-pulse" />
                <div className="h-3 w-16 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="mt-8 rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden">
        <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
          <div className="h-5 w-40 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
          <div className="h-4 w-24 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-black/5 dark:divide-white/5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-6 py-4">
              <div className="h-4 w-32 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              <div className="h-4 w-20 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              <div className="flex-1 flex items-center gap-2">
                <div className="h-2 w-24 bg-black/5 dark:bg-white/5 rounded-full animate-pulse" />
                <div className="h-4 w-10 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              </div>
              <div className="h-4 w-12 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              <div className="h-6 w-16 bg-black/5 dark:bg-white/5 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
