"use client";

import { useTranslations, useLocale } from "next-intl";
import { 
  CalendarDays, 
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Filter,
  MoreVertical,
  Plus,
  Check,
  X
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

export default function LeavesPage() {
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";

  // Mock data for KPIs
  const kpis = [
    {
      title: isAr ? "طلبات معلقة" : "Pending Requests",
      value: "12",
      icon: <Clock className="w-5 h-5" />,
      trend: { value: 3, isPositive: false, label: isAr ? "طلبات جديدة" : "new requests" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: isAr ? "موافق عليها هذا الشهر" : "Approved This Month",
      value: "45",
      icon: <CheckCircle className="w-5 h-5" />,
      trend: { value: 10, isPositive: true, label: "%" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: isAr ? "إجازات نشطة حالياً" : "Active Leaves",
      value: "18",
      icon: <CalendarDays className="w-5 h-5" />,
      trend: { value: 2, isPositive: false, label: isAr ? "موظف غائب" : "absent employees" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: isAr ? "طلبات مرفوضة" : "Rejected Requests",
      value: "4",
      icon: <XCircle className="w-5 h-5 text-red-500" />,
      trend: { value: 1, isPositive: false, label: isAr ? "هذا الأسبوع" : "this week" },
      colorClass: "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400"
    }
  ];

  // Mock data for leave requests
  const requests = [
    {
      id: "REQ-2026-101",
      employee: {
        name: "Sarah El-Din",
        nameAr: "سارة الدين",
        role: "Senior Civil Engineer",
        roleAr: "مهندس مدني أول",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
      },
      type: "Annual Leave",
      typeAr: "إجازة سنوية",
      startDate: "2026-06-15",
      endDate: "2026-06-30",
      duration: "14 Days",
      durationAr: "14 يوم",
      status: "Pending",
      statusAr: "قيد الانتظار"
    },
    {
      id: "REQ-2026-102",
      employee: {
        name: "John Smith",
        nameAr: "جون سميث",
        role: "Electrical Supervisor",
        roleAr: "مشرف كهرباء",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=John"
      },
      type: "Sick Leave",
      typeAr: "إجازة مرضية",
      startDate: "2026-05-12",
      endDate: "2026-05-14",
      duration: "3 Days",
      durationAr: "3 أيام",
      status: "Approved",
      statusAr: "موافق عليه"
    },
    {
      id: "REQ-2026-103",
      employee: {
        name: "Ali Raza",
        nameAr: "علي رضا",
        role: "Heavy Equipment Operator",
        roleAr: "سائق معدات ثقيلة",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ali"
      },
      type: "Unpaid Leave",
      typeAr: "إجازة بدون راتب",
      startDate: "2026-07-01",
      endDate: "2026-07-15",
      duration: "15 Days",
      durationAr: "15 يوم",
      status: "Rejected",
      statusAr: "مرفوض"
    },
    {
      id: "REQ-2026-104",
      employee: {
        name: "Fatima Hassan",
        nameAr: "فاطمة حسن",
        role: "Procurement Officer",
        roleAr: "مسؤول مشتريات",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Fatima"
      },
      type: "Maternity Leave",
      typeAr: "إجازة أمومة",
      startDate: "2026-08-01",
      endDate: "2026-10-31",
      duration: "90 Days",
      durationAr: "90 يوم",
      status: "Pending",
      statusAr: "قيد الانتظار"
    },
    {
      id: "REQ-2026-105",
      employee: {
        name: "Khalid Ibrahim",
        nameAr: "خالد إبراهيم",
        role: "Construction Foreman",
        roleAr: "فورمان إنشائي",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Khalid"
      },
      type: "Annual Leave",
      typeAr: "إجازة سنوية",
      startDate: "2026-05-01",
      endDate: "2026-05-10",
      duration: "10 Days",
      durationAr: "10 أيام",
      status: "Approved",
      statusAr: "موافق عليه"
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
              { label: isAr ? "الإجازات" : "Leaves", href: "/dashboard/team/leaves" }
            ]} 
          />
          <h1 className="text-2xl font-bold tracking-tight mt-1">{isAr ? "الإجازات" : "Leaves"}</h1>
          <p className="text-muted-foreground">
            {isAr ? "إدارة طلبات الإجازات والمغادرات والأرصدة" : "Manage leave requests, absences, and balances"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            {tCommon("actions.advancedFilter")}
          </Button>
          <Button className="gap-2 bg-[#111] hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black">
            <Plus className="w-4 h-4" />
            {isAr ? "طلب إجازة" : "Request Leave"}
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
            <CardTitle className="text-xl font-bold">{isAr ? "سجل طلبات الإجازات" : "Leave Requests Log"}</CardTitle>
            <CardDescription>{isAr ? "جميع طلبات الإجازات الحالية والسابقة" : "All current and past leave requests"}</CardDescription>
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
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "نوع الإجازة" : "Leave Type"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "تاريخ البدء" : "Start Date"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "تاريخ الانتهاء" : "End Date"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "المدة" : "Duration"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="text-center w-[80px]">{tCommon("actions._value")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={req.employee.image} alt={req.employee.name} />
                          <AvatarFallback>{req.employee.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{isAr ? req.employee.nameAr : req.employee.name}</span>
                          <span className="text-xs text-muted-foreground">{isAr ? req.employee.roleAr : req.employee.role}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{isAr ? req.typeAr : req.type}</TableCell>
                    <TableCell className="text-sm">{req.startDate}</TableCell>
                    <TableCell className="text-sm">{req.endDate}</TableCell>
                    <TableCell className="text-sm">{isAr ? req.durationAr : req.duration}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={cn(
                          "font-medium",
                          req.status === "Approved" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                          req.status === "Pending" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                          "bg-red-500/10 text-red-600 dark:text-red-400"
                        )}
                      >
                        {isAr ? req.statusAr : req.status}
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
                            <DropdownMenuItem className="gap-2 text-green-600 focus:text-green-600">
                              <Check className="w-4 h-4" /> {isAr ? "قبول الطلب" : "Approve Request"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-red-600 focus:text-red-600">
                              <X className="w-4 h-4" /> {isAr ? "رفض الطلب" : "Reject Request"}
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
