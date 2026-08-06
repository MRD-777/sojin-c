"use client";

import { useTranslations, useLocale } from "next-intl";
import dynamic from "next/dynamic";
import { 
  Calendar, 
  Clock, 
  UserCheck, 
  UserX, 
  Search, 
  Filter, 
  Download, 
  MoreVertical,
  MapPin,
  Fingerprint,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  History,
  TrendingUp,
  Map
} from "lucide-react";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
import { StatCard } from "@/components/dashboard/global/stat-card";

const ChartSkeleton = () => (
  <div className="h-[300px] w-full animate-pulse bg-black/5 dark:bg-white/5 rounded-xl" />
);

const AttendanceHeatmap = dynamic(
  () => import("@/components/dashboard/team-charts").then(mod => mod.AttendanceHeatmap),
  { ssr: false, loading: ChartSkeleton }
);

const ProjectAttendanceChart = dynamic(
  () => import("@/components/dashboard/team-charts").then(mod => mod.ProjectAttendanceChart),
  { ssr: false, loading: ChartSkeleton }
);

export default function AttendancePage() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";

  // Mock stats
  const stats = [
    {
      title: t("team.attendance.stats.presentToday"),
      value: "412",
      icon: <UserCheck className="w-5 h-5" />,
      trend: { value: 94.2, isPositive: true, label: "%" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("team.attendance.stats.lateArrivals"),
      value: "24",
      icon: <Clock className="w-5 h-5" />,
      trend: { value: 5.2, isPositive: false, label: "%" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("team.attendance.stats.overtimeHours"),
      value: "156",
      icon: <History className="w-5 h-5" />,
      trend: { value: 12, isPositive: true, label: "hrs" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: t("team.attendance.stats.absent"),
      value: "18",
      icon: <UserX className="w-5 h-5" />,
      trend: { value: 3.8, isPositive: true, label: "%" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    }
  ];

  // Mock attendance logs
  const logs = [
    {
      id: "LOG-5501",
      employee: {
        name: "Ahmed Mansour",
        nameAr: "أحمد منصور",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed"
      },
      checkIn: "07:45 AM",
      checkOut: "04:30 PM",
      workHours: "8h 45m",
      overtime: "45m",
      location: "Marina Tower 3",
      locationAr: "برج مارينا 3",
      method: "Biometric",
      methodAr: "بصمة",
      status: "Present",
      statusAr: "حاضر"
    },
    {
      id: "LOG-5502",
      employee: {
        name: "Sarah El-Din",
        nameAr: "سارة الدين",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
      },
      checkIn: "08:15 AM",
      checkOut: "---",
      workHours: "Running",
      workHoursAr: "قيد العمل",
      overtime: "0",
      location: "Al Shifa Hospital",
      locationAr: "مستشفى الشفاء",
      method: "Mobile GPS",
      methodAr: "GPS الجوال",
      status: "Late",
      statusAr: "متأخر"
    },
    {
      id: "LOG-5503",
      employee: {
        name: "Michael Chen",
        nameAr: "مايكل تشن",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael"
      },
      checkIn: "07:55 AM",
      checkOut: "05:00 PM",
      workHours: "9h 05m",
      overtime: "1h 05m",
      location: "Marina Tower 3",
      locationAr: "برج مارينا 3",
      method: "Face ID",
      methodAr: "بصمة وجه",
      status: "Present",
      statusAr: "حاضر"
    },
    {
      id: "LOG-5504",
      employee: {
        name: "Khalid Ibrahim",
        nameAr: "خالد إبراهيم",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Khalid"
      },
      checkIn: "---",
      checkOut: "---",
      workHours: "---",
      overtime: "---",
      location: "Nakhla Villa",
      locationAr: "فيلا النخلة",
      method: "---",
      status: "Absent",
      statusAr: "غائب"
    },
    {
      id: "LOG-5505",
      employee: {
        name: "Fatima Hassan",
        nameAr: "فاطمة حسن",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Fatima"
      },
      checkIn: "08:00 AM",
      checkOut: "04:00 PM",
      workHours: "8h 00m",
      overtime: "0",
      location: "Head Office",
      locationAr: "المكتب الرئيسي",
      method: "Biometric",
      methodAr: "بصمة",
      status: "Present",
      statusAr: "حاضر"
    }
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Breadcrumbs 
            items={[
              { label: t("nav.dashboard"), href: "/dashboard" },
              { label: t("nav.team"), href: "/dashboard/team" },
              { label: t("team.attendance.title"), href: "/dashboard/team/attendance" }
            ]} 
          />
          <h1 className="text-2xl font-bold tracking-tight mt-1">{t("team.attendance.title")}</h1>
          <p className="text-muted-foreground">{t("team.attendance.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Map className="w-4 h-4" />
            {isAr ? "عرض الخريطة" : "Live Map View"}
          </Button>
          <Button className="gap-2 bg-[#111] hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black">
            <Download className="w-4 h-4" />
            {isAr ? "تقرير الحضور" : "Download Report"}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <StatCard
            key={i}
            title={s.title}
            value={s.value}
            icon={s.icon}
            trend={s.trend}
            colorClass={s.colorClass}
          />
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111]">
          <CardHeader>
            <CardTitle className="text-lg font-bold">{isAr ? "كثافة الحضور الشهري" : "Monthly Attendance Density"}</CardTitle>
            <CardDescription>{isAr ? "آخر 30 يوم" : "Last 30 days"}</CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceHeatmap />
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-2 border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111]">
          <CardHeader>
            <CardTitle className="text-lg font-bold">{isAr ? "الحضور حسب المشروع" : "Attendance by Project"}</CardTitle>
            <CardDescription>{isAr ? "نسبة الالتزام بالوقت لكل موقع" : "Time compliance rate per site"}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectAttendanceChart />
          </CardContent>
        </Card>
      </div>

      {/* Daily Logs Table */}
      <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{isAr ? "سجل الحضور اليومي" : "Daily Attendance Logs"}</CardTitle>
            <CardDescription>{isAr ? "تتبع مباشر لعمليات تسجيل الدخول والخروج" : "Live tracking of check-ins and check-outs"}</CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder={isAr ? "بحث عن موظف..." : "Search employee..."} 
                className={isAr ? "pr-10" : "pl-10"} 
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-black/5 dark:bg-white/5">
              <TableRow>
                <TableHead className={isAr ? "text-right" : "text-left"}>{t("team.attendance.table.employee")}</TableHead>
                <TableHead className="text-center">{t("team.attendance.table.checkIn")}</TableHead>
                <TableHead className="text-center">{t("team.attendance.table.checkOut")}</TableHead>
                <TableHead className="text-center">{t("team.attendance.table.workHours")}</TableHead>
                <TableHead className="text-center">{t("team.attendance.table.overtime")}</TableHead>
                <TableHead className={isAr ? "text-right" : "text-left"}>{t("team.attendance.table.location")}</TableHead>
                <TableHead className="text-center">{t("team.attendance.table.method")}</TableHead>
                <TableHead className="text-center">{t("team.attendance.table.status")}</TableHead>
                <TableHead className="text-center w-[80px]">{t("actions._value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={log.employee.image} />
                        <AvatarFallback>{log.employee.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{isAr ? log.employee.nameAr : log.employee.name}</span>
                        <span className="text-[10px] text-muted-foreground">{log.id}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-medium">{log.checkIn}</span>
                      {log.status === "Late" && (
                        <span className="text-[10px] text-amber-600 font-bold">{isAr ? "+15 دقيقة" : "+15 min"}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">{log.checkOut}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-normal">
                      {isAr ? log.workHoursAr || log.workHours : log.workHours}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm font-semibold text-blue-600">{log.overtime}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm">{isAr ? log.locationAr : log.location}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                     <div className="flex items-center justify-center gap-1.5">
                       {log.method === "Biometric" && <Fingerprint className="w-3.5 h-3.5 text-blue-500" />}
                       {log.method === "Mobile GPS" && <Smartphone className="w-3.5 h-3.5 text-green-500" />}
                       <span className="text-xs">{isAr ? log.methodAr : log.method}</span>
                     </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="outline"
                      className="font-medium gap-1.5"
                    >
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        log.status === "Present" ? "bg-green-500" :
                        log.status === "Late" ? "bg-amber-500" :
                        "bg-red-500"
                      )} />
                      {isAr ? log.statusAr : log.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
                          <MoreVertical className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem className="gap-2">
                            <History className="w-4 h-4" /> {isAr ? "سجل الحركات" : "Log History"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <MapPin className="w-4 h-4" /> {isAr ? "موقع التحضير" : "Check-in Location"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2 text-blue-600">
                             {isAr ? "تعديل السجل" : "Edit Log"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
