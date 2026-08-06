export default function AuditLoading() {
  return (
    <div className="space-y-8 px-4 sm:px-8 py-8 w-full mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div className="space-y-3">
          <div className="h-8 w-52 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-28 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-black/10 dark:bg-white/10 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-black/5 dark:border-white/5 p-4 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] h-10 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
        <div className="h-10 w-24 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
        <div className="h-10 w-24 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
        <div className="h-10 w-24 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden">
        <div className="p-4 border-b border-black/5 dark:border-white/5">
          <div className="h-5 w-32 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-black/5 dark:divide-white/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-6 py-4">
              <div className="w-4 h-4 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              <div className="space-y-1">
                <div className="h-4 w-36 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
                <div className="h-3 w-20 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 animate-pulse" />
                <div className="space-y-1">
                  <div className="h-3.5 w-20 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
                  <div className="h-3 w-14 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-6 w-16 bg-black/5 dark:bg-white/5 rounded-full animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-full max-w-[200px] bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
