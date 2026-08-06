"use client";

import { useTranslations, useLocale } from "next-intl";
import dynamic from "next/dynamic";
import { 
  Users, 
  HardHat, 
  UserCheck, 
  UserMinus, 
  Briefcase, 
  Calendar, 
  AlertTriangle,
  TrendingUp,
  Search,
  Filter,
  MoreVertical,
  Plus,
  Mail,
  Phone,
  ArrowUpRight,
  ArrowDownRight
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

const ChartSkeleton = () => (
  <div className="h-[350px] w-full animate-pulse bg-black/5 dark:bg-white/5 rounded-xl" />
);

const WorkforceDistributionChart = dynamic(
  () => import("@/components/dashboard/team-charts").then(mod => mod.WorkforceDistributionChart),
  { ssr: false, loading: ChartSkeleton }
);

const HiringTrendsChart = dynamic(
  () => import("@/components/dashboard/team-charts").then(mod => mod.HiringTrendsChart),
  { ssr: false, loading: ChartSkeleton }
);

export default function TeamOverviewPage() {
  const t = useTranslations("Common.team.overview");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";

  // Mock data for the 8 KPIs
  const kpis = [
    {
      title: t("stats.totalWorkforce"),
      value: "486",
      icon: <Users className="w-5 h-5" />,
      trend: { value: 18, isPositive: true, label: isAr ? "هذا الشهر" : "this month" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("stats.engineers"),
      value: "68",
      icon: <Briefcase className="w-5 h-5" />,
      trend: { value: 3, isPositive: true, label: "+" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("stats.skilledTrades"),
      value: "312",
      icon: <HardHat className="w-5 h-5" />,
      trend: { value: 12, isPositive: true, label: "+" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("stats.administrative"),
      value: "45",
      icon: <UserCheck className="w-5 h-5" />,
      trend: { value: 0, isPositive: true, label: "-" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("stats.attendanceRate"),
      value: "94.2%",
      icon: <TrendingUp className="w-5 h-5" />,
      trend: { value: 1.5, isPositive: true, label: "%" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("stats.probation"),
      value: "14",
      icon: <Calendar className="w-5 h-5" />,
      trend: { value: 0, isPositive: true, label: "-" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("stats.expiringContracts"),
      value: "9",
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      trend: { value: 30, isPositive: false, label: isAr ? "يوم" : "days" },
      colorClass: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
    },
    {
      title: t("stats.turnoverRate"),
      value: "3.2%",
      icon: <UserMinus className="w-5 h-5" />,
      trend: { value: 0.5, isPositive: true, label: "%" }, // Positive trend means decrease in turnover
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    }
  ];

  // Representative employees for the table
  const employees = [
    {
      id: "EMP-1024",
      name: "Ahmed Mansour",
      nameAr: "أحمد منصور",
      role: "Project Manager",
      roleAr: "مدير مشروع",
      category: "Management",
      categoryAr: "إدارة",
      department: "Operations",
      departmentAr: "التشغيل",
      project: "Marina Tower 3",
      projectAr: "برج مارينا 3",
      attendance: "Present",
      attendanceAr: "حاضر",
      contract: "Full-time",
      contractAr: "دوام كامل",
      expiry: "2026-12-31",
      status: "Active",
      statusAr: "نشط",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed"
    },
    {
      id: "EMP-1085",
      name: "Sarah El-Din",
      nameAr: "سارة الدين",
      role: "Senior Civil Engineer",
      roleAr: "مهندس مدني أول",
      category: "Engineering",
      categoryAr: "هندسة",
      department: "Civil",
      departmentAr: "المدني",
      project: "Al Shifa Hospital",
      projectAr: "مستشفى الشفاء",
      attendance: "Present",
      attendanceAr: "حاضر",
      contract: "Full-time",
      contractAr: "دوام كامل",
      expiry: "2025-08-15",
      status: "Active",
      statusAr: "نشط",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
    },
    {
      id: "EMP-2041",
      name: "Michael Chen",
      nameAr: "مايكل تشن",
      role: "Planning Engineer",
      roleAr: "مهندس تخطيط",
      category: "Engineering",
      categoryAr: "هندسة",
      department: "Planning",
      departmentAr: "التخطيط",
      project: "Marina Tower 3",
      projectAr: "برج مارينا 3",
      attendance: "Remote",
      attendanceAr: "عن بعد",
      contract: "Full-time",
      contractAr: "دوام كامل",
      expiry: "2026-05-20",
      status: "Active",
      statusAr: "نشط",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael"
    },
    {
      id: "EMP-3012",
      name: "Khalid Ibrahim",
      nameAr: "خالد إبراهيم",
      role: "Construction Foreman",
      roleAr: "فورمان إنشائي",
      category: "Supervision",
      categoryAr: "إشراف",
      department: "Field Ops",
      departmentAr: "العمليات الميدانية",
      project: "Nakhla Villa",
      projectAr: "فيلا النخلة",
      attendance: "Present",
      attendanceAr: "حاضر",
      contract: "Full-time",
      contractAr: "دوام كامل",
      expiry: "2024-06-30",
      status: "Active",
      statusAr: "نشط",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Khalid"
    },
    {
      id: "EMP-4056",
      name: "Zaid Omar",
      nameAr: "زيد عمر",
      role: "HSE Specialist",
      roleAr: "أخصائي سلامة",
      category: "Safety",
      categoryAr: "سلامة",
      department: "HSE",
      departmentAr: "السلامة",
      project: "Marina Tower 3",
      projectAr: "برج مارينا 3",
      attendance: "Present",
      attendanceAr: "حاضر",
      contract: "Contractor",
      contractAr: "مقاول",
      expiry: "2024-05-15",
      status: "Expiring Soon",
      statusAr: "ينتهي قريباً",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Zaid"
    },
    {
      id: "EMP-5089",
      name: "Fatima Hassan",
      nameAr: "فاطمة حسن",
      role: "Procurement Officer",
      roleAr: "مسؤول مشتريات",
      category: "Admin",
      categoryAr: "إدارة",
      department: "Procurement",
      departmentAr: "المشتريات",
      project: "Head Office",
      projectAr: "المكتب الرئيسي",
      attendance: "Present",
      attendanceAr: "حاضر",
      contract: "Full-time",
      contractAr: "دوام كامل",
      expiry: "2027-01-10",
      status: "Active",
      statusAr: "نشط",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Fatima"
    },
    {
      id: "EMP-6022",
      name: "Tariq Ali",
      nameAr: "طارق علي",
      role: "Steel Fixer",
      roleAr: "حداد مسلح",
      category: "Technical",
      categoryAr: "فني",
      department: "Field Ops",
      departmentAr: "العمليات الميدانية",
      project: "Nakhla Villa",
      projectAr: "فيلا النخلة",
      attendance: "Present",
      attendanceAr: "حاضر",
      contract: "Full-time",
      contractAr: "دوام كامل",
      expiry: "2025-02-28",
      status: "Active",
      statusAr: "نشط",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tariq"
    },
    {
      id: "EMP-7014",
      name: "John Smith",
      nameAr: "جون سميث",
      role: "Electrical Supervisor",
      roleAr: "مشرف كهرباء",
      category: "Supervision",
      categoryAr: "إشراف",
      department: "MEP",
      departmentAr: "ميكانيكا وكهرباء",
      project: "Al Shifa Hospital",
      projectAr: "مستشفى الشفاء",
      attendance: "Sick Leave",
      attendanceAr: "إجازة مرضية",
      contract: "Full-time",
      contractAr: "دوام كامل",
      expiry: "2026-08-12",
      status: "On Leave",
      statusAr: "في إجازة",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=John"
    },
    {
      id: "EMP-8045",
      name: "Omar Bakri",
      nameAr: "عمر بكري",
      role: "Quantity Surveyor",
      roleAr: "حصر كميات",
      category: "Engineering",
      categoryAr: "هندسة",
      department: "Cost Control",
      departmentAr: "التحكم بالتكاليف",
      project: "Al Shifa Hospital",
      projectAr: "مستشفى الشفاء",
      attendance: "Present",
      attendanceAr: "حاضر",
      contract: "Full-time",
      contractAr: "دوام كامل",
      expiry: "2025-11-30",
      status: "Probation",
      statusAr: "تحت التجربة",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Omar"
    },
    {
      id: "EMP-9033",
      name: "Ali Raza",
      nameAr: "علي رضا",
      role: "Heavy Equipment Operator",
      roleAr: "سائق معدات ثقيلة",
      category: "Technical",
      categoryAr: "فني",
      department: "Equipment",
      departmentAr: "المعدات",
      project: "Marina Tower 3",
      projectAr: "برج مارينا 3",
      attendance: "Present",
      attendanceAr: "حاضر",
      contract: "Daily",
      contractAr: "يومي",
      expiry: "2024-05-10",
      status: "Active",
      statusAr: "نشط",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ali"
    },
    {
      id: "EMP-1011",
      name: "Laila Karim",
      nameAr: "ليلى كريم",
      role: "Architectural Designer",
      roleAr: "مصمم معماري",
      category: "Engineering",
      categoryAr: "هندسة",
      department: "Design",
      departmentAr: "التصميم",
      project: "Head Office",
      projectAr: "المكتب الرئيسي",
      attendance: "Absent",
      attendanceAr: "غائب",
      contract: "Full-time",
      contractAr: "دوام كامل",
      expiry: "2026-03-25",
      status: "Suspended",
      statusAr: "موقوف",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Laila"
    },
    {
      id: "EMP-1102",
      name: "Hassan Mahmoud",
      nameAr: "حسن محمود",
      role: "Carpenter",
      roleAr: "نجار",
      category: "Technical",
      categoryAr: "فني",
      department: "Field Ops",
      departmentAr: "العمليات الميدانية",
      project: "Nakhla Villa",
      projectAr: "فيلا النخلة",
      attendance: "Present",
      attendanceAr: "حاضر",
      contract: "Full-time",
      contractAr: "دوام كامل",
      expiry: "2025-07-20",
      status: "Active",
      statusAr: "نشط",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Hassan"
    }
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Breadcrumbs 
            items={[
              { label: tCommon("nav.dashboard"), href: "/dashboard" },
              { label: tCommon("nav.team"), href: "/dashboard/team" }
            ]} 
          />
          <h1 className="text-2xl font-bold tracking-tight mt-1">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            {t("actions.advancedFilter")}
          </Button>
          <Button className="gap-2 bg-[#111] hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black">
            <Plus className="w-4 h-4" />
            {t("actions.addEmployee")}
          </Button>
        </div>
      </div>

      {/* Urgent Alerts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-black/5 dark:border-white/5 bg-[#fafafa] dark:bg-[#111]">
          <div className="bg-black/5 dark:bg-white/5 p-2 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div className="text-sm font-medium">
            {t("alerts.contractsExpiring", { count: 9 })}
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-black/5 dark:border-white/5 bg-[#fafafa] dark:bg-[#111]">
          <div className="bg-black/5 dark:bg-white/5 p-2 rounded-lg">
            <Calendar className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-sm font-medium">
            {t("alerts.probationEnding", { count: 14 })}
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-black/5 dark:border-white/5 bg-[#fafafa] dark:bg-[#111]">
          <div className="bg-black/5 dark:bg-white/5 p-2 rounded-lg">
            <TrendingUp className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-sm font-medium">
            {t("alerts.overtimeLimit", { count: 3 })}
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl border border-black/5 dark:border-white/5 bg-[#fafafa] dark:bg-[#111]">
          <div className="bg-black/5 dark:bg-white/5 p-2 rounded-lg">
            <Briefcase className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-sm font-medium">
            {t("alerts.pendingTransfers", { count: 5 })}
          </div>
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{t("charts.workforceDistribution")}</CardTitle>
            <CardDescription>{t("charts.byCategory")}</CardDescription>
          </CardHeader>
          <CardContent>
            <WorkforceDistributionChart />
          </CardContent>
        </Card>
        <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">{t("charts.hiringTrends")}</CardTitle>
            <CardDescription>{t("charts.hiredVsLeft")}</CardDescription>
          </CardHeader>
          <CardContent>
            <HiringTrendsChart />
          </CardContent>
        </Card>
      </div>

      {/* Employees Table Section */}
      <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={tCommon("searchPlaceholder")} 
              className={isAr ? "pr-10" : "pl-10"} 
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-black/5 dark:bg-white/5">
                <TableRow>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{t("table.employee")}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{t("table.role")}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{t("table.category")}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{t("table.department")}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{t("table.currentProject")}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{t("table.attendanceToday")}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{t("table.status")}</TableHead>
                  <TableHead className="text-center w-[80px]">{tCommon("actions._value")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={emp.image} alt={emp.name} />
                          <AvatarFallback>{emp.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{isAr ? emp.nameAr : emp.name}</span>
                          <span className="text-xs text-muted-foreground">{emp.id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{isAr ? emp.roleAr : emp.role}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {isAr ? emp.categoryAr : emp.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{isAr ? emp.departmentAr : emp.department}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{isAr ? emp.projectAr : emp.project}</span>
                        <span className="text-xs text-muted-foreground">{isAr ? emp.contractAr : emp.contract}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className="font-medium gap-1.5"
                      >
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          emp.attendance === "Present" ? "bg-green-500" :
                          emp.attendance === "Absent" ? "bg-red-500" :
                          "bg-blue-500"
                        )} />
                        {isAr ? emp.attendanceAr : emp.attendance}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className="font-medium gap-1.5"
                      >
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          emp.status === "Active" ? "bg-green-500" :
                          emp.status === "Expiring Soon" ? "bg-amber-500" :
                          emp.status === "Probation" ? "bg-blue-500" :
                          emp.status === "On Leave" ? "bg-gray-500" :
                          "bg-red-500"
                        )} />
                        {isAr ? emp.statusAr : emp.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
                            <MoreVertical className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>{t("actions.options")}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2">
                              <Mail className="w-4 h-4" /> {t("actions.sendEmail")}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <Phone className="w-4 h-4" /> {t("actions.call")}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <Briefcase className="w-4 h-4" /> {t("actions.transferProject")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 text-red-600 focus:text-red-600">
                              <UserMinus className="w-4 h-4" /> {t("actions.terminate")}
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
          <div className="p-4 border-t flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t("actions.showingXofY", { count: 12, total: 486 })}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>{t("actions.prev")}</Button>
              <Button variant="outline" size="sm">{t("actions.next")}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
