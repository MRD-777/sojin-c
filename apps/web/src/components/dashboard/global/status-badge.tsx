"use client";

import { cn } from "@/lib/utils";

export type StatusType = "active" | "completed" | "pending" | "delayed" | "cancelled" | "default";

interface StatusBadgeProps {
  status: StatusType | string;
  label: string;
  className?: string;
}

const statusStyles: Record<StatusType, string> = {
  active: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  delayed: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 border-rose-200 dark:border-rose-800",
  cancelled: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  // Fallback to default if the string passed is not one of our predefined keys
  const styleClass = statusStyles[status as StatusType] || statusStyles.default;

  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", styleClass, className)}>
      {label}
    </span>
  );
}
