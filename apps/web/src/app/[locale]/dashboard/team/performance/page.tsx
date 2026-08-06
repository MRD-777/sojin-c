"use client";

import { useTranslations, useLocale } from "next-intl";
import { 
  Users, 
  Target,
  Award,
  AlertTriangle,
  Search,
  Filter,
  MoreVertical,
  Plus,
  Mail,
  TrendingUp,
  TrendingDown
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

export default function PerformancePage() {
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";

  // Mock data for KPIs
  const kpis = [
    {
      title: isAr ? "متوسط التقييم العام" : "Average Overall Score",
      value: "86%",
      icon: <Target className="w-5 h-5" />,
      trend: { value: 2.5, isPositive: true, label: "%" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: isAr ? "تقييمات معلقة" : "Pending Reviews",
      value: "24",
      icon: <Users className="w-5 h-5" />,
      trend: { value: 5, isPositive: false, label: isAr ? "هذا الأسبوع" : "this week" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: isAr ? "أداء متميز" : "Top Performers",
      value: "15%",
      icon: <Award className="w-5 h-5" />,
      trend: { value: 3, isPositive: true, label: "%" },
      colorClass: "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
    },
    {
      title: isAr ? "بحاجة للتحسين" : "Needs Improvement",
      value: "8",
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      trend: { value: 2, isPositive: false, label: isAr ? "موظف" : "employees" },
      colorClass: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
    }
  ];

  // Mock data for performance reviews
  const reviews = [
    {
      id: "REV-2026-001",
      employee: {
        name: "Ahmed Mansour",
        nameAr: "أحمد منصور",
        role: "Project Manager",
        roleAr: "مدير مشروع",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed"
      },
      period: "Q1 2026",
      score: 92,
      goalsCompleted: "8/10",
      reviewer: {
        name: "Khalid Al-Otaibi",
        nameAr: "خالد العتيبي"
      },
      status: "Completed",
      statusAr: "مكتمل",
      trend: "up"
    },
    {
      id: "REV-2026-002",
      employee: {
        name: "Sarah El-Din",
        nameAr: "سارة الدين",
        role: "Senior Civil Engineer",
        roleAr: "مهندس مدني أول",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
      },
      period: "Q1 2026",
      score: 88,
      goalsCompleted: "7/8",
      reviewer: {
        name: "Ahmed Mansour",
        nameAr: "أحمد منصور"
      },
      status: "Completed",
      statusAr: "مكتمل",
      trend: "up"
    },
    {
      id: "REV-2026-003",
      employee: {
        name: "Omar Bakri",
        nameAr: "عمر بكري",
        role: "Quantity Surveyor",
        roleAr: "حصر كميات",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Omar"
      },
      period: "Q1 2026",
      score: 65,
      goalsCompleted: "4/8",
      reviewer: {
        name: "Sarah El-Din",
        nameAr: "سارة الدين"
      },
      status: "Under Review",
      statusAr: "قيد المراجعة",
      trend: "down"
    },
    {
      id: "REV-2026-004",
      employee: {
        name: "Zaid Omar",
        nameAr: "زيد عمر",
        role: "HSE Specialist",
        roleAr: "أخصائي سلامة",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Zaid"
      },
      period: "Q1 2026",
      score: 0,
      goalsCompleted: "0/5",
      reviewer: {
        name: "Safety Director",
        nameAr: "مدير السلامة"
      },
      status: "Pending",
      statusAr: "قيد الانتظار",
      trend: "neutral"
    },
    {
      id: "REV-2026-005",
      employee: {
        name: "Michael Chen",
        nameAr: "مايكل تشن",
        role: "Planning Engineer",
        roleAr: "مهندس تخطيط",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael"
      },
      period: "Q1 2026",
      score: 95,
      goalsCompleted: "12/12",
      reviewer: {
        name: "Ahmed Mansour",
        nameAr: "أحمد منصور"
      },
      status: "Completed",
      statusAr: "مكتمل",
      trend: "up"
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
              { label: isAr ? "تقييم الأداء" : "Performance", href: "/dashboard/team/performance" }
            ]} 
          />
          <h1 className="text-2xl font-bold tracking-tight mt-1">{isAr ? "تقييم الأداء" : "Performance"}</h1>
          <p className="text-muted-foreground">
            {isAr ? "إدارة تقييمات أداء الموظفين والأهداف" : "Manage employee performance reviews and goals"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            {tCommon("actions.advancedFilter")}
          </Button>
          <Button className="gap-2 bg-[#111] hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black">
            <Plus className="w-4 h-4" />
            {isAr ? "تقييم جديد" : "New Evaluation"}
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

      {/* Reviews Table Section */}
      <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{isAr ? "سجل التقييمات" : "Evaluations Log"}</CardTitle>
            <CardDescription>{isAr ? "قائمة بجميع تقييمات الأداء للموظفين" : "List of all employee performance evaluations"}</CardDescription>
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
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "الفترة" : "Period"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "النتيجة" : "Score"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "الأهداف المنجزة" : "Goals Completed"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "المُقيّم" : "Reviewer"}</TableHead>
                  <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="text-center w-[80px]">{tCommon("actions._value")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={review.employee.image} alt={review.employee.name} />
                          <AvatarFallback>{review.employee.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{isAr ? review.employee.nameAr : review.employee.name}</span>
                          <span className="text-xs text-muted-foreground">{isAr ? review.employee.roleAr : review.employee.role}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{review.period}</TableCell>
                    <TableCell>
                      {review.score > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{review.score}%</span>
                          {review.trend === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
                          {review.trend === "down" && <TrendingDown className="w-3 h-3 text-red-500" />}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{review.goalsCompleted}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {isAr ? review.reviewer.nameAr : review.reviewer.name}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={cn(
                          "font-medium",
                          review.status === "Completed" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                          review.status === "Under Review" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                          "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white"
                        )}
                      >
                        {isAr ? review.statusAr : review.status}
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
                              {tCommon("actions.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <Mail className="w-4 h-4" /> {tCommon("actions.sendEmail")}
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
