"use client";

import { useTranslations, useLocale } from "next-intl";
import { 
  ShieldAlert, 
  HardHat,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  MoreVertical,
  Plus,
  FileText
} from "lucide-react";
import { StatCard } from "@/components/dashboard/global/stat-card";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";

export default function SafetyPage() {
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";

  // Mock data for KPIs
  const kpis = [
    {
      title: isAr ? "أيام بدون حوادث" : "Days Without Incidents",
      value: "142",
      icon: <ShieldAlert className="w-5 h-5" />,
      trend: { value: 12, isPositive: true, label: isAr ? "أفضل من السابق" : "better than last" },
      colorClass: "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400"
    },
    {
      title: isAr ? "حوادث قيد التحقيق" : "Incidents Under Investigation",
      value: "2",
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      trend: { value: 1, isPositive: false, label: isAr ? "هذا الشهر" : "this month" },
      colorClass: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
    },
    {
      title: isAr ? "مخالفات السلامة" : "Safety Violations",
      value: "7",
      icon: <HardHat className="w-5 h-5" />,
      trend: { value: 3, isPositive: true, label: isAr ? "أقل من الشهر الماضي" : "less than last month" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: isAr ? "التدقيقات المكتملة" : "Completed Audits",
      value: "24",
      icon: <CheckCircle2 className="w-5 h-5" />,
      trend: { value: 100, isPositive: true, label: isAr ? "معدل الإنجاز" : "completion rate" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    }
  ];

  // Mock data for safety incidents
  const incidents = [
    {
      id: "INC-2026-042",
      employee: {
        name: "Omar Hassan",
        nameAr: "عمر حسن",
        role: "Scaffolding Worker",
        roleAr: "عامل سقالات",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Omar"
      },
      type: "Near Miss",
      typeAr: "حادث وشيك",
      date: "2026-04-12",
      project: "Downtown Tower A",
      projectAr: "برج وسط المدينة أ",
      severity: "Low",
      severityAr: "منخفض",
      status: "Resolved",
      statusAr: "تم الحل"
    },
    {
      id: "INC-2026-043",
      employee: {
        name: "Youssef Ahmed",
        nameAr: "يوسف أحمد",
        role: "Crane Operator",
        roleAr: "مشغل رافعة",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Youssef"
      },
      type: "Safety Violation",
      typeAr: "مخالفة سلامة",
      date: "2026-04-15",
      project: "Mall of Arabia Extension",
      projectAr: "توسعة مول العرب",
      severity: "Medium",
      severityAr: "متوسط",
      status: "Under Investigation",
      statusAr: "قيد التحقيق"
    },
    {
      id: "INC-2026-044",
      employee: {
        name: "Mahmoud Ali",
        nameAr: "محمود علي",
        role: "Welder",
        roleAr: "لحام",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mahmoud"
      },
      type: "Minor Injury",
      typeAr: "إصابة طفيفة",
      date: "2026-04-18",
      project: "New Capital Bridge",
      projectAr: "جسر العاصمة الإدارية",
      severity: "High",
      severityAr: "عالي",
      status: "Under Investigation",
      statusAr: "قيد التحقيق"
    },
    {
      id: "INC-2026-045",
      employee: {
        name: "Tarek Yassin",
        nameAr: "طارق ياسين",
        role: "Site Engineer",
        roleAr: "مهندس موقع",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tarek"
      },
      type: "Equipment Damage",
      typeAr: "تلف معدات",
      date: "2026-04-20",
      project: "Downtown Tower B",
      projectAr: "برج وسط المدينة ب",
      severity: "Medium",
      severityAr: "متوسط",
      status: "Resolved",
      statusAr: "تم الحل"
    },
    {
      id: "INC-2026-046",
      employee: {
        name: "Kareem Sayed",
        nameAr: "كريم سيد",
        role: "Electrician",
        roleAr: "كهربائي",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kareem"
      },
      type: "Near Miss",
      typeAr: "حادث وشيك",
      date: "2026-04-22",
      project: "Smart Village Complex",
      projectAr: "مجمع القرية الذكية",
      severity: "Low",
      severityAr: "منخفض",
      status: "Open",
      statusAr: "مفتوح"
    }
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Breadcrumbs 
            items={[
              { label: tCommon("nav.dashboard"), href: "/dashboard" },
              { label: tCommon("nav.team"), href: "/dashboard/team" },
              { label: isAr ? "السلامة المهنية (HSE)" : "Safety (HSE)", href: "/dashboard/team/safety" }
            ]} 
          />
          <h1 className="text-2xl font-bold tracking-tight mt-1">{isAr ? "السلامة المهنية (HSE)" : "Safety (HSE)"}</h1>
          <p className="text-muted-foreground">
            {isAr ? "سجل حوادث السلامة والمخالفات والتحقيقات" : "Log of safety incidents, violations, and investigations"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <FileText className="w-4 h-4" />
            {isAr ? "تصدير التقرير" : "Export Report"}
          </Button>
          <Button className="gap-2 bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700">
            <Plus className="w-4 h-4" />
            {isAr ? "تسجيل حادث جديد" : "Log Incident"}
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <StatCard
            key={index}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            trend={kpi.trend}
            colorClass={kpi.colorClass}
          />
        ))}
      </div>

      {/* Table Section */}
      <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{isAr ? "سجل الحوادث والمخالفات" : "Incidents & Violations Log"}</CardTitle>
            <CardDescription>{isAr ? "تتبع جميع الأحداث المتعلقة بالسلامة في الموقع" : "Track all site safety-related events"}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="hidden md:flex gap-2">
              <Filter className="w-4 h-4" />
              {tCommon("actions.filter")}
            </Button>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder={tCommon("searchPlaceholder")} 
                className={isAr ? "pr-10" : "pl-10"} 
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-black/5 dark:bg-white/5">
                <TableRow>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "الرقم المرجعي" : "ID"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "الموظف المعني" : "Involved Employee"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "النوع" : "Type"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "المشروع" : "Project"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "التاريخ" : "Date"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "الخطورة" : "Severity"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="text-center w-[80px]">{tCommon("actions._value")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow key={incident.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <TableCell className="font-mono text-xs">{incident.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border">
                          <AvatarImage src={incident.employee.image} alt={incident.employee.name} />
                          <AvatarFallback>{incident.employee.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{isAr ? incident.employee.nameAr : incident.employee.name}</span>
                          <span className="text-xs text-muted-foreground">{isAr ? incident.employee.roleAr : incident.employee.role}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{isAr ? incident.typeAr : incident.type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{isAr ? incident.projectAr : incident.project}</TableCell>
                    <TableCell className="text-sm">{incident.date}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={cn(
                          "font-medium",
                          incident.severity === "Low" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                          incident.severity === "Medium" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                          "bg-red-500/10 text-red-600 dark:text-red-400"
                        )}
                      >
                        {isAr ? incident.severityAr : incident.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={cn(
                          "font-medium",
                          incident.status === "Resolved" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                          incident.status === "Under Investigation" ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" :
                          "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                        )}
                      >
                        {isAr ? incident.statusAr : incident.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
                            <MoreVertical className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>{tCommon("actions.options")}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2">
                              {isAr ? "تحديث الحالة" : "Update Status"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              {isAr ? "إضافة ملاحظات" : "Add Notes"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2">
                              {tCommon("actions.view")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
