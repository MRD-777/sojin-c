"use client";

import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number; // percentage
    isPositive: boolean;
    label?: string;
  };
  className?: string;
  colorClass?: string; // Tailwind color class for the icon background
}

export function StatCard({ title, value, icon, trend, className, colorClass = "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400" }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden transition-all duration-200 hover:shadow-md", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</p>
          </div>
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", colorClass)}>
            {icon}
          </div>
        </div>
        
        {trend && (
          <div className="mt-4 flex items-center text-sm">
            <span className={cn(
              "font-medium flex items-center",
              trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}>
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
            {trend.label && (
              <span className="ml-2 text-slate-500 dark:text-slate-400">{trend.label}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
