export default function ReportsLoading() {
  return (
    <div className="space-y-8 px-4 sm:px-8 py-8 w-full mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div className="space-y-3">
          <div className="h-8 w-48 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-black/10 dark:bg-white/10 rounded-lg animate-pulse" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-black/10 dark:border-white/10 mb-6 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-28 bg-black/5 dark:bg-white/5 rounded-t-lg animate-pulse" />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden">
        <div className="p-4 border-b border-black/5 dark:border-white/5">
          <div className="h-5 w-36 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
        </div>
        <div className="bg-[#fafafa] dark:bg-[#0a0a0a] px-6 py-4 border-b border-black/5 dark:border-white/5 flex gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 bg-black/5 dark:bg-white/5 rounded animate-pulse" style={{ width: `${50 + Math.random() * 50}px` }} />
          ))}
        </div>
        <div className="divide-y divide-black/5 dark:divide-white/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-8 px-6 py-4">
              <div className="h-4 w-28 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              <div className="h-4 w-8 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              <div className="h-4 w-12 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              <div className="h-4 w-12 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              <div className="h-4 w-16 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              <div className="h-4 w-12 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
