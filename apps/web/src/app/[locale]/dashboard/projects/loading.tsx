export default function ProjectsLoading() {
  return (
    <div className="space-y-8 px-4 sm:px-8 py-8 w-full mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-black/5 dark:border-white/5 pb-8">
        <div className="space-y-3">
          <div className="h-3 w-24 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
          <div className="h-10 w-64 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
          <div className="h-4 w-96 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-11 w-28 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
          <div className="h-11 w-32 bg-black/10 dark:bg-white/10 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Filters + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="col-span-3 rounded-2xl border border-black/5 dark:border-white/5 p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[250px] h-10 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
            <div className="h-10 w-24 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
            <div className="h-10 w-24 bg-black/5 dark:bg-white/5 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="rounded-2xl bg-black/10 dark:bg-white/10 p-4 animate-pulse">
          <div className="h-3 w-20 bg-white/20 rounded animate-pulse mb-2" />
          <div className="h-7 w-16 bg-white/20 rounded animate-pulse" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-2xl border border-black/5 dark:border-white/5 overflow-hidden">
        {/* Table Header */}
        <div className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 px-6 py-5 flex gap-6">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-3 bg-black/5 dark:bg-white/5 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}px` }} />
          ))}
        </div>
        {/* Table Rows */}
        <div className="divide-y divide-black/5 dark:divide-white/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-6 py-6">
              <div className="w-4 h-4 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-48 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
                <div className="h-3 w-24 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              </div>
              <div className="h-4 w-32 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-black/5 dark:bg-white/5 animate-pulse" />
                <div className="h-4 w-16 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
              </div>
              <div className="h-6 w-16 bg-black/5 dark:bg-white/5 rounded-full animate-pulse" />
              <div className="flex-1">
                <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full animate-pulse" />
              </div>
              <div className="h-4 w-24 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
