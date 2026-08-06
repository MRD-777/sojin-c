"use client";

import { useTranslations } from "next-intl";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

export function CashFlowChart() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("Common");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-[300px] w-full animate-pulse bg-black/5 dark:bg-white/5 rounded-xl"></div>;

  const isDark = resolvedTheme === "dark";
  const textColor = isDark ? "#999" : "#666";
  const gridColor = isDark ? "#ffffff10" : "#00000010";
  
  const cashFlowData = [
    { name: t("months.jan"), revenue: 400000, expenses: 240000 },
    { name: t("months.feb"), revenue: 300000, expenses: 139000 },
    { name: t("months.mar"), revenue: 200000, expenses: 980000 },
    { name: t("months.apr"), revenue: 278000, expenses: 390800 },
    { name: t("months.may"), revenue: 189000, expenses: 480000 },
    { name: t("months.jun"), revenue: 239000, expenses: 380000 },
    { name: t("months.jul"), revenue: 349000, expenses: 430000 },
    { name: t("months.aug"), revenue: 450000, expenses: 510000 },
    { name: t("months.sep"), revenue: 600000, expenses: 430000 },
    { name: t("months.oct"), revenue: 700000, expenses: 500000 },
    { name: t("months.nov"), revenue: 850000, expenses: 600000 },
    { name: t("months.dec"), revenue: 1100000, expenses: 750000 },
  ];

  return (
    <div className="h-[300px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={cashFlowData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isDark ? "#ffffff" : "#111111"} stopOpacity={0.15} />
              <stop offset="95%" stopColor={isDark ? "#ffffff" : "#111111"} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: textColor, fontSize: 12 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: textColor, fontSize: 12 }} 
            tickFormatter={(value) => `$${value / 1000}k`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDark ? "#111" : "#fff", 
              borderColor: isDark ? "#333" : "#eee",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)"
            }} 
            itemStyle={{ fontSize: "13px", fontWeight: 500 }}
            labelStyle={{ color: textColor, marginBottom: "8px", fontSize: "12px" }}
          />
          <Area type="monotone" dataKey="revenue" name={t("dashboardPage.totalRevenue")} stroke={isDark ? "#ffffff" : "#111111"} strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
          <Area type="monotone" dataKey="expenses" name={t("dashboardPage.totalExpenses")} stroke="#94a3b8" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProjectsPhaseChart() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("Common");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-[300px] w-full animate-pulse bg-black/5 dark:bg-white/5 rounded-xl"></div>;

  const isDark = resolvedTheme === "dark";
  const textColor = isDark ? "#999" : "#666";
  const gridColor = isDark ? "#ffffff10" : "#00000010";

  const projectsByPhaseData = [
    { name: t("phases.design"), active: 4, delayed: 1 },
    { name: t("phases.permits"), active: 2, delayed: 2 },
    { name: t("phases.excavation"), active: 3, delayed: 0 },
    { name: t("phases.structure"), active: 5, delayed: 1 },
    { name: t("phases.finishing"), active: 3, delayed: 3 },
    { name: t("phases.handover"), active: 1, delayed: 0 },
  ];

  return (
    <div className="h-[300px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={projectsByPhaseData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: textColor, fontSize: 12 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: textColor, fontSize: 12 }} 
          />
          <Tooltip 
            cursor={{ fill: isDark ? "#ffffff05" : "#00000005" }}
            contentStyle={{ 
              backgroundColor: isDark ? "#111" : "#fff", 
              borderColor: isDark ? "#333" : "#eee",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)"
            }} 
            itemStyle={{ fontSize: "13px", fontWeight: 500 }}
            labelStyle={{ color: textColor, marginBottom: "8px", fontSize: "12px" }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
          <Bar dataKey="active" name={t("dashboardPage.onTrack")} stackId="a" fill={isDark ? "#ffffff" : "#111111"} radius={[0, 0, 4, 4]} />
          <Bar dataKey="delayed" name={t("dashboardPage.delayed")} stackId="a" fill={isDark ? "#555555" : "#999999"} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
