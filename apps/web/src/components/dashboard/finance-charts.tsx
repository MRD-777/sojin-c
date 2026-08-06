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
  Legend,
  Cell
} from "recharts";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

export function MonthlyCashFlowChart() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("Common");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-[350px] w-full animate-pulse bg-black/5 dark:bg-white/5 rounded-xl"></div>;

  const isDark = resolvedTheme === "dark";
  const textColor = isDark ? "#999" : "#666";
  const gridColor = isDark ? "#ffffff10" : "#00000010";
  
  // Mock data representing monthly cash flow (in millions)
  const cashFlowData = [
    { name: t("months.jan"), revenues: 4.5, expenses: 3.2, net: 1.3 },
    { name: t("months.feb"), revenues: 5.2, expenses: 3.8, net: 1.4 },
    { name: t("months.mar"), revenues: 4.8, expenses: 4.1, net: 0.7 },
    { name: t("months.apr"), revenues: 6.1, expenses: 4.5, net: 1.6 },
    { name: t("months.may"), revenues: 5.9, expenses: 5.0, net: 0.9 },
    { name: t("months.jun"), revenues: 7.2, expenses: 4.8, net: 2.4 },
    { name: t("months.jul"), revenues: 8.5, expenses: 6.2, net: 2.3 },
    { name: t("months.aug"), revenues: 9.1, expenses: 6.5, net: 2.6 },
    { name: t("months.sep"), revenues: 8.8, expenses: 7.0, net: 1.8 },
    { name: t("months.oct"), revenues: 10.5, expenses: 8.2, net: 2.3 },
    { name: t("months.nov"), revenues: 11.2, expenses: 8.5, net: 2.7 },
    { name: t("months.dec"), revenues: 12.5, expenses: 9.0, net: 3.5 },
  ];

  return (
    <div className="h-[350px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={cashFlowData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRevFin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isDark ? "#ffffff" : "#111111"} stopOpacity={0.15} />
              <stop offset="95%" stopColor={isDark ? "#ffffff" : "#111111"} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorExpFin" x1="0" y1="0" x2="0" y2="1">
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
            tickFormatter={(value) => `${value}M`}
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
            formatter={(value: any) => [`${value}M EGP`, ""]}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }} />
          <Area 
            type="monotone" 
            dataKey="revenues" 
            name={t("finance.overview.charts.revenue")} 
            stroke={isDark ? "#ffffff" : "#111111"} 
            strokeWidth={2} 
            fillOpacity={1} 
            fill="url(#colorRevFin)" 
          />
          <Area 
            type="monotone" 
            dataKey="expenses" 
            name={t("finance.overview.charts.expenses")} 
            stroke="#94a3b8" 
            strokeWidth={2} 
            fillOpacity={1} 
            fill="url(#colorExpFin)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpensesByCategoryChart() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("Common");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-[350px] w-full animate-pulse bg-black/5 dark:bg-white/5 rounded-xl"></div>;

  const isDark = resolvedTheme === "dark";
  const textColor = isDark ? "#999" : "#666";
  const gridColor = isDark ? "#ffffff10" : "#00000010";

  // Mock data for expenses by category
  const expensesData = [
    { name: t("finance.overview.charts.categories.materials"), amount: 45.2 },
    { name: t("finance.overview.charts.categories.salaries"), amount: 28.5 },
    { name: t("finance.overview.charts.categories.subcontractors"), amount: 35.8 },
    { name: t("finance.overview.charts.categories.equipment"), amount: 15.4 },
    { name: t("finance.overview.charts.categories.admin"), amount: 8.2 },
    { name: t("finance.overview.charts.categories.other"), amount: 4.1 },
  ];

  // Using a gradient of grays/blacks
  const getBarColor = (index: number) => {
    if (isDark) {
      const colors = ["#ffffff", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569"];
      return colors[index % colors.length];
    } else {
      const colors = ["#0f172a", "#1e293b", "#334155", "#475569", "#64748b", "#94a3b8"];
      return colors[index % colors.length];
    }
  };

  return (
    <div className="h-[350px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={expensesData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={gridColor} />
          <XAxis 
            type="number"
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: textColor, fontSize: 12 }} 
            tickFormatter={(value) => `${value}M`}
          />
          <YAxis 
            type="category"
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: textColor, fontSize: 15 }} 
            width={50}
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
            formatter={(value: any) => [`${value}M EGP`, ""]}
          />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={24}>
            {expensesData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
