"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  showLabel?: boolean;
  colorClass?: string; // e.g. "bg-blue-500", "bg-emerald-500"
  heightClass?: string; // e.g. "h-2", "h-3"
  className?: string;
}

export function ProgressBar({ 
  value, 
  max = 100, 
  showLabel = true, 
  colorClass = "bg-blue-600 dark:bg-blue-500", 
  heightClass = "h-2",
  className 
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{percentage.toFixed(0)}%</span>
        </div>
      )}
      <div className={cn("w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden", heightClass)}>
        <div 
          className={cn("h-full rounded-full transition-all duration-500 ease-out", colorClass)} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
