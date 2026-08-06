"use client";

import { useTranslations, useLocale } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { useTheme } from "next-themes";

export const WorkforceDistributionChart = () => {
  const t = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const gridColor = isDark ? "#ffffff10" : "#00000010";

  // Data for distribution by category
  const data = [
    { name: isAr ? "المهندسون" : "Engineers", value: 68, color: "#2563eb" },
    { name: isAr ? "العمالة الفنية" : "Skilled Trades", value: 312, color: "#16a34a" },
    { name: isAr ? "الإشراف" : "Supervision", value: 61, color: "#ca8a04" },
    { name: isAr ? "الإدارة" : "Administrative", value: 45, color: "#dc2626" },
  ];

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDark ? "#111" : "#fff", 
              border: "none", 
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
            }}
          />
          <Legend verticalAlign="bottom" height={36}/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const HiringTrendsChart = () => {
  const t = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const gridColor = isDark ? "#ffffff10" : "#00000010";

  // Mock data for last 6 months
  const data = [
    { month: isAr ? "يناير" : "Jan", hired: 12, left: 2 },
    { month: isAr ? "فبراير" : "Feb", hired: 15, left: 4 },
    { month: isAr ? "مارس" : "Mar", hired: 8, left: 1 },
    { month: isAr ? "أبريل" : "Apr", hired: 22, left: 5 },
    { month: isAr ? "مايو" : "May", hired: 18, left: 3 },
    { month: isAr ? "يونيو" : "Jun", hired: 10, left: 2 },
  ];

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={isAr ? "horizontal" : "horizontal"}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: isDark ? "#aaa" : "#666", fontSize: 12 }} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: isDark ? "#aaa" : "#666", fontSize: 12 }} 
            orientation={isAr ? "right" : "left"}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isDark ? "#111" : "#fff", 
              border: "none", 
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
            }}
          />
          <Legend verticalAlign="top" align="right" height={36}/>
          <Bar 
            name={isAr ? "تعيين" : "Hired"} 
            dataKey="hired" 
            fill="#2563eb" 
            radius={[4, 4, 0, 0]} 
            barSize={20}
          />
          <Bar 
            name={isAr ? "مغادرة" : "Left"} 
            dataKey="left" 
            fill="#dc2626" 
            radius={[4, 4, 0, 0]} 
            barSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ProjectAttendanceChart = () => {
  const t = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const gridColor = isDark ? "#ffffff10" : "#00000010";

  const data = [
    { project: isAr ? "برج مارينا" : "Marina Tower", rate: 98 },
    { project: isAr ? "مستشفى الشفاء" : "Al Shifa Hospital", rate: 92 },
    { project: isAr ? "فيلا النخلة" : "Nakhla Villa", rate: 88 },
    { project: isAr ? "طريق الساحل" : "Coast Road", rate: 95 },
    { project: isAr ? "مول العرب" : "Mall of Arabia", rate: 91 },
  ];

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
          <XAxis 
            type="number" 
            domain={[0, 100]} 
            hide 
          />
          <YAxis 
            dataKey="project" 
            type="category" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: isDark ? "#aaa" : "#666", fontSize: 11 }} 
            width={120}
            orientation={isAr ? "right" : "left"}
          />
          <Tooltip 
            formatter={(value) => [`${value}%`, isAr ? "نسبة الحضور" : "Attendance Rate"]}
            contentStyle={{ 
              backgroundColor: isDark ? "#111" : "#fff", 
              border: "none", 
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
            }}
          />
          <Bar 
            dataKey="rate" 
            fill="#2563eb" 
            radius={[0, 4, 4, 0]} 
            barSize={15}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const AttendanceHeatmap = () => {
  const locale = useLocale();
  const isAr = locale === "ar";
  
  // Generating mock data for a month (30 days)
  const days = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    value: Math.floor(Math.random() * 40) + 60, // 60% to 100%
  }));

  const getColor = (val: number) => {
    if (val > 95) return "bg-green-600";
    if (val > 90) return "bg-green-500/80";
    if (val > 85) return "bg-green-500/60";
    if (val > 80) return "bg-amber-500/60";
    return "bg-red-500/60";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => (
          <div key={d.day} className="flex flex-col items-center gap-1">
            <div 
              className={`w-full aspect-square rounded-sm ${getColor(d.value)} transition-all hover:scale-110 cursor-help`}
              title={`${isAr ? "اليوم" : "Day"} ${d.day}: ${d.value}%`}
            />
            <span className="text-[10px] text-muted-foreground">{d.day}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-white/5">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-red-500/60" />
          <span>{isAr ? "منخفض" : "Low"}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-green-600" />
          <span>{isAr ? "مرتفع" : "High"}</span>
        </div>
      </div>
    </div>
  );
};
