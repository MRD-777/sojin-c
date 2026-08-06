"use client";

import { useTranslations, useLocale } from "next-intl";
import { 
  GraduationCap, 
  FileCheck,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  MoreVertical,
  Plus,
  Download
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

export default function TrainingPage() {
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";

  // Mock data for KPIs
  const kpis = [
    {
      title: isAr ? "شهادات نشطة" : "Active Certifications",
      value: "142",
      icon: <FileCheck className="w-5 h-5" />,
      trend: { value: 12, isPositive: true, label: isAr ? "هذا الشهر" : "this month" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: isAr ? "تنتهي قريباً" : "Expiring Soon",
      value: "8",
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      trend: { value: 4, isPositive: false, label: isAr ? "خلال 30 يوم" : "within 30 days" },
      colorClass: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
    },
    {
      title: isAr ? "ساعات التدريب" : "Training Hours",
      value: "1,240",
      icon: <Clock className="w-5 h-5" />,
      trend: { value: 15, isPositive: true, label: "%" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: isAr ? "دورات قيد التنفيذ" : "Active Courses",
      value: "15",
      icon: <GraduationCap className="w-5 h-5" />,
      trend: { value: 3, isPositive: true, label: "+" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    }
  ];

  // Mock data for training/certifications
  const records = [
    {
      id: "CERT-001",
      employee: {
        name: "Zaid Omar",
        nameAr: "زيد عمر",
        role: "HSE Specialist",
        roleAr: "أخصائي سلامة",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Zaid"
      },
      course: "OSHA 30-Hour Construction",
      courseAr: "أوشا 30 ساعة إنشاءات",
      provider: "OSHA Institute",
      providerAr: "معهد أوشا",
      issueDate: "2024-01-15",
      expiryDate: "2027-01-15",
      status: "Active",
      statusAr: "نشط"
    },
    {
      id: "CERT-002",
      employee: {
        name: "Sarah El-Din",
        nameAr: "سارة الدين",
        role: "Senior Civil Engineer",
        roleAr: "مهندس مدني أول",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
      },
      course: "PMP Certification",
      courseAr: "إدارة المشاريع الاحترافية PMP",
      provider: "PMI",
      providerAr: "معهد إدارة المشاريع",
      issueDate: "2023-05-20",
      expiryDate: "2026-05-20",
      status: "Active",
      statusAr: "نشط"
    },
    {
      id: "CERT-003",
      employee: {
        name: "Tariq Ali",
        nameAr: "طارق علي",
        role: "Steel Fixer",
        roleAr: "حداد مسلح",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tariq"
      },
      course: "Working at Heights",
      courseAr: "العمل على ارتفاعات",
      provider: "Internal Safety Dept",
      providerAr: "إدارة السلامة الداخلية",
      issueDate: "2025-06-10",
      expiryDate: "2026-06-10",
      status: "Expiring Soon",
      statusAr: "ينتهي قريباً"
    },
    {
      id: "CERT-004",
      employee: {
        name: "Ali Raza",
        nameAr: "علي رضا",
        role: "Heavy Equipment Operator",
        roleAr: "سائق معدات ثقيلة",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ali"
      },
      course: "Crane Operator License",
      courseAr: "رخصة قيادة رافعة",
      provider: "Ministry of Transport",
      providerAr: "وزارة النقل",
      issueDate: "2021-02-15",
      expiryDate: "2026-02-15",
      status: "Expired",
      statusAr: "منتهي"
    },
    {
      id: "CERT-005",
      employee: {
        name: "Ahmed Mansour",
        nameAr: "أحمد منصور",
        role: "Project Manager",
        roleAr: "مدير مشروع",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed"
      },
      course: "Advanced Risk Management",
      courseAr: "إدارة المخاطر المتقدمة",
      provider: "Coursera",
      providerAr: "كورسيرا",
      issueDate: "-",
      expiryDate: "-",
      status: "In Progress",
      statusAr: "قيد التدريب"
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
              { label: isAr ? "التدريب والشهادات" : "Training & Certs", href: "/dashboard/team/training" }
            ]} 
          />
          <h1 className="text-2xl font-bold tracking-tight mt-1">{isAr ? "التدريب والشهادات" : "Training & Certs"}</h1>
          <p className="text-muted-foreground">
            {isAr ? "تتبع دورات التدريب والشهادات المهنية للموظفين" : "Track employee training courses and professional certifications"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            {tCommon("actions.advancedFilter")}
          </Button>
          <Button className="gap-2 bg-[#111] hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black">
            <Plus className="w-4 h-4" />
            {isAr ? "إضافة شهادة" : "Add Certification"}
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
            <CardTitle className="text-xl font-bold">{isAr ? "سجل الشهادات" : "Certifications Log"}</CardTitle>
            <CardDescription>{isAr ? "جميع الشهادات المهنية الحالية والسابقة" : "All current and past professional certifications"}</CardDescription>
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
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "الموظف" : "Employee"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "الدورة / الشهادة" : "Course / Certification"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "مقدم الخدمة" : "Provider"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "تاريخ الإصدار" : "Issue Date"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "تاريخ الانتهاء" : "Expiry Date"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="text-center w-[80px]">{tCommon("actions._value")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={record.employee.image} alt={record.employee.name} />
                          <AvatarFallback>{record.employee.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{isAr ? record.employee.nameAr : record.employee.name}</span>
                          <span className="text-xs text-muted-foreground">{isAr ? record.employee.roleAr : record.employee.role}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{isAr ? record.courseAr : record.course}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{isAr ? record.providerAr : record.provider}</TableCell>
                    <TableCell className="text-sm">{record.issueDate}</TableCell>
                    <TableCell className="text-sm">{record.expiryDate}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={cn(
                          "font-medium",
                          record.status === "Active" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                          record.status === "Expiring Soon" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                          record.status === "In Progress" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                          "bg-red-500/10 text-red-600 dark:text-red-400"
                        )}
                      >
                        {isAr ? record.statusAr : record.status}
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
                              {tCommon("actions.view")}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <Download className="w-4 h-4" /> {isAr ? "تحميل الشهادة" : "Download Cert"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              {tCommon("actions.edit")}
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
