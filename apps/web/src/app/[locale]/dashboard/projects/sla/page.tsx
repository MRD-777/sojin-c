"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { 
  AlertCircle, 
  Search, 
  Download, 
  Clock,
  TrendingUp,
  TrendingDown,
  FileWarning,
  CheckSquare
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ProjectSLA {
  id: string;
  projectName: string;
  projectManager: string;
  onTimeCompletion: number;
  overdueTasks: number;
  avgResponseTime: number;
  status: 'excellent' | 'warning' | 'critical';
}

export default function ProjectSLAPage() {
  const t = useTranslations("Common");

  const projects: ProjectSLA[] = [
    {
      id: "PRJ-001",
      projectName: "برج مارينا الماسي 3",
      projectManager: "م. محمد منصور",
      onTimeCompletion: 95,
      overdueTasks: 2,
      avgResponseTime: 1.5,
      status: 'excellent'
    },
    {
      id: "PRJ-002",
      projectName: "مجمع النخلة السكني",
      projectManager: "م. عمر زيد",
      onTimeCompletion: 72,
      overdueTasks: 14,
      avgResponseTime: 4.2,
      status: 'critical'
    },
    {
      id: "PRJ-003",
      projectName: "توسعة المستشفى العام",
      projectManager: "م. خالد سعيد",
      onTimeCompletion: 88,
      overdueTasks: 5,
      avgResponseTime: 2.1,
      status: 'warning'
    },
    {
      id: "PRJ-004",
      projectName: "مركز الأعمال المالي",
      projectManager: "م. أحمد الفهد",
      onTimeCompletion: 92,
      overdueTasks: 3,
      avgResponseTime: 1.8,
      status: 'excellent'
    }
  ];

  return (
    <div className="space-y-6 px-4 sm:px-6 py-6 w-full max-w-[1800px] mx-auto animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            مؤشرات الإنجاز (SLA)
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-2xl">
            نظرة مبسطة ومباشرة على أداء المشاريع ومدى الالتزام بمواعيد التسليم وسرعة الاستجابة.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            تصدير التقرير
          </Button>
        </div>
      </header>

      {/* SLA Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500 dark:text-neutral-400">الإنجاز في الوقت المحدد</CardTitle>
            <CheckSquare className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">86.7%</div>
            <div className="text-xs font-medium text-green-600 dark:text-green-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> 
              معدل ممتاز هذا الشهر
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500 dark:text-neutral-400">متوسط سرعة الاستجابة</CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">2.4 <span className="text-sm font-medium text-neutral-500">ساعة</span></div>
            <div className="text-xs font-medium text-blue-600 dark:text-blue-500 mt-1 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> 
              أسرع من الشهر الماضي
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500 dark:text-neutral-400">إجمالي المهام المتأخرة</CardTitle>
            <FileWarning className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-500">24 <span className="text-sm font-medium text-red-400">مهمة</span></div>
            <div className="text-xs font-medium text-red-600 dark:text-red-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> 
              يحتاج إلى انتباه فوري
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        <CardHeader className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 px-6">
          <div className="flex items-center gap-4">
            <CardTitle className="text-base font-semibold text-neutral-900 dark:text-white">تفاصيل أداء المشاريع</CardTitle>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input placeholder="بحث عن مشروع..." className="pl-9 h-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-start">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 text-xs bg-white dark:bg-black">
                  <th className="px-6 py-3 font-medium text-start">المشروع / المدير</th>
                  <th className="px-6 py-3 font-medium text-start">الإنجاز في الوقت المحدد</th>
                  <th className="px-6 py-3 font-medium text-center">متوسط سرعة الاستجابة</th>
                  <th className="px-6 py-3 font-medium text-center">المهام المتأخرة</th>
                  <th className="px-6 py-3 font-medium text-center">حالة المشروع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-neutral-900 dark:text-white">{project.projectName}</div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{project.projectManager}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{project.onTimeCompletion}%</span>
                        <div className="w-24 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${project.onTimeCompletion >= 90 ? 'bg-green-500' : project.onTimeCompletion >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${project.onTimeCompletion}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium">
                      {project.avgResponseTime} ساعة
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-semibold ${project.overdueTasks > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {project.overdueTasks}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold ${
                        project.status === 'excellent' ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 
                        project.status === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 
                        'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                      }`}>
                        {project.status === 'excellent' ? 'ممتاز' : project.status === 'warning' ? 'انتباه' : 'متأخر'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Alert Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-red-900 dark:text-red-400">تنبيه: مشروع متأخر</h4>
            <p className="text-xs text-red-800/80 dark:text-red-200/80 mt-1">
              مشروع <strong>مجمع النخلة السكني</strong> لديه 14 مهمة متأخرة ومعدل الإنجاز انخفض إلى 72%. يرجى المتابعة مع مدير المشروع.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 bg-white dark:bg-transparent border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20">
          مراسلة مدير المشروع
        </Button>
      </div>
    </div>
  );
}
