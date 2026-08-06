"use client";

import { useTranslations, useLocale } from "next-intl";
import { 
  Network, 
  Users, 
  UserCheck, 
  Building2, 
  ChevronRight, 
  ChevronDown,
  Mail,
  Phone,
  MoreVertical,
  Plus,
  Search,
  Filter,
  Download,
  Shield,
  HardHat,
  Zap,
  Pipette,
  Layers,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
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
import { useState } from "react";

export default function OrgChartPage() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [expandedDepts, setExpandedDepts] = useState<string[]>(["executive", "civil"]);

  const toggleDept = (id: string) => {
    setExpandedDepts(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Mock data for Departments
  const departments = [
    {
      id: "executive",
      name: t("team.orgChart.departments.executive"),
      head: {
        name: "Eng. Robert Wilson",
        nameAr: "م. روبرت ويلسون",
        role: "Chief Operating Officer",
        roleAr: "رئيس العمليات",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Robert"
      },
      employees: 12,
      occupancy: "92%",
      status: "Active",
      icon: <Building2 className="w-5 h-5" />,
      subDepts: []
    },
    {
      id: "civil",
      name: t("team.orgChart.departments.civil"),
      head: {
        name: "Eng. Ahmed Mansour",
        nameAr: "م. أحمد منصور",
        role: "Head of Civil Engineering",
        roleAr: "رئيس الهندسة المدنية",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed"
      },
      employees: 145,
      occupancy: "96%",
      status: "Active",
      icon: <Layers className="w-5 h-5" />,
      subDepts: ["Structures", "Infrastructure", "Finishing"]
    },
    {
      id: "electrical",
      name: t("team.orgChart.departments.electrical"),
      head: {
        name: "Eng. Sarah El-Din",
        nameAr: "م. سارة الدين",
        role: "Senior Electrical Manager",
        roleAr: "مدير الكهرباء الرئيسي",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
      },
      employees: 86,
      occupancy: "88%",
      status: "Active",
      icon: <Zap className="w-5 h-5" />,
      subDepts: ["Power Systems", "Low Voltage", "Automation"]
    },
    {
      id: "mechanical",
      name: t("team.orgChart.departments.mechanical"),
      head: {
        name: "Eng. Michael Chen",
        nameAr: "م. مايكل تشن",
        role: "MEP Director",
        roleAr: "مدير MEP",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael"
      },
      employees: 92,
      occupancy: "94%",
      status: "Active",
      icon: <Pipette className="w-5 h-5" />,
      subDepts: ["HVAC", "Plumbing", "Firefighting"]
    },
    {
      id: "planning",
      name: t("team.orgChart.departments.planning"),
      head: {
        name: "Eng. Khalid Ibrahim",
        nameAr: "م. خالد إبراهيم",
        role: "Planning Manager",
        roleAr: "مدير التخطيط",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Khalid"
      },
      employees: 28,
      occupancy: "100%",
      status: "Active",
      icon: <ChevronRight className="w-5 h-5" />,
      subDepts: ["Project Controls", "Surveying", "BIM"]
    },
    {
      id: "quality",
      name: t("team.orgChart.departments.quality"),
      head: {
        name: "Eng. Fatima Hassan",
        nameAr: "م. فاطمة حسن",
        role: "QA/QC Manager",
        roleAr: "مدير الجودة",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Fatima"
      },
      employees: 24,
      occupancy: "85%",
      status: "Active",
      icon: <CheckCircle2 className="w-5 h-5" />,
      subDepts: ["Quality Control", "Quality Assurance", "Testing Lab"]
    },
    {
      id: "safety",
      name: t("team.orgChart.departments.safety"),
      head: {
        name: "Zaid Omar",
        nameAr: "زيد عمر",
        role: "HSE Director",
        roleAr: "مدير السلامة",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Zaid"
      },
      employees: 32,
      occupancy: "90%",
      status: "Active",
      icon: <Shield className="w-5 h-5" />,
      subDepts: ["Site Safety", "Environment", "Health Compliance"]
    },
    {
      id: "admin",
      name: t("team.orgChart.departments.admin"),
      head: {
        name: "Laila Karim",
        nameAr: "ليلى كريم",
        role: "HR & Admin Manager",
        roleAr: "مدير الموارد البشرية",
        image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Laila"
      },
      employees: 45,
      occupancy: "98%",
      status: "Active",
      icon: <Users className="w-5 h-5" />,
      subDepts: ["Human Resources", "Finance", "Legal", "Procurement"]
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
              { label: t("team.orgChart.title"), href: "/dashboard/team/org-chart" }
            ]} 
          />
          <h1 className="text-2xl font-bold tracking-tight mt-1">{t("team.orgChart.title")}</h1>
          <p className="text-muted-foreground">{t("team.orgChart.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            {t("team.orgChart.actions.exportPdf")}
          </Button>
          <Button className="gap-2 bg-[#111] hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black">
            <Plus className="w-4 h-4" />
            {t("team.orgChart.actions.addDept")}
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111]">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-black/5 dark:bg-white/5 p-3 rounded-xl">
              <Building2 className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("team.orgChart.stats.departments")}</p>
              <h3 className="text-2xl font-bold">12</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111]">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-black/5 dark:bg-white/5 p-3 rounded-xl">
              <Network className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("team.orgChart.stats.leadership")}</p>
              <h3 className="text-2xl font-bold">45</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111]">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-black/5 dark:bg-white/5 p-3 rounded-xl">
              <UserCheck className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("team.orgChart.stats.occupancy")}</p>
              <h3 className="text-2xl font-bold">94.8%</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Org Chart Section (Interactive Tree) */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t("team.orgChart.stats.interactiveTitle")}</h2>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-white/50 dark:bg-black/20">{t("team.orgChart.stats.managementLevel")}</Badge>
            <Badge variant="outline" className="bg-white/50 dark:bg-black/20">{t("team.orgChart.stats.executiveLevel")}</Badge>
          </div>
        </div>

        <div className="relative min-h-[500px] w-full bg-black/5 dark:bg-white/5 rounded-2xl border border-dashed border-muted-foreground/20 overflow-hidden flex flex-col items-center p-8">
          {/* Top Level - CEO */}
          <div className="flex flex-col items-center mb-12 relative">
            <Card className="w-64 border border-black/10 dark:border-white/10 shadow-lg bg-[#fafafa] dark:bg-[#111]">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <Avatar className="h-16 w-16 mb-2 border border-black/10 dark:border-white/10">
                  <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=CEO" />
                  <AvatarFallback>CEO</AvatarFallback>
                </Avatar>
                <h4 className="font-bold text-sm">Eng. Ibrahim Khalil</h4>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{isAr ? "الرئيس التنفيذي" : "Chief Executive Officer"}</p>
                <div className="flex gap-2 mt-3">
                   <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full"><Mail className="w-3.5 h-3.5" /></Button>
                   <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full"><Phone className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
            {/* Connector Line */}
            <div className="absolute -bottom-12 left-1/2 w-px h-12 bg-muted-foreground/30" />
          </div>

          {/* Second Level - VPs / Operations */}
          <div className="flex flex-wrap justify-center gap-12 w-full max-w-6xl relative pt-4">
             {/* Horizontal Connection Line */}
             <div className="absolute top-0 left-[15%] right-[15%] h-px bg-muted-foreground/30" />
             
             {/* Departments Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {departments.slice(0, 4).map((dept) => (
                  <div key={dept.id} className="flex flex-col items-center relative">
                    <div className="absolute -top-4 w-px h-4 bg-muted-foreground/30" />
                    <Card 
                      className={`w-64 transition-all hover:scale-105 hover:shadow-lg cursor-pointer bg-[#fafafa] dark:bg-[#111] ${expandedDepts.includes(dept.id) ? 'border-black/20 dark:border-white/20 ring-1 ring-black/10 dark:ring-white/10' : 'border-black/5 dark:border-white/5'}`}
                      onClick={() => toggleDept(dept.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="bg-muted p-2 rounded-lg">
                            {dept.icon}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm leading-tight">{dept.name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{dept.employees} {isAr ? "موظف" : "Employees"}</span>
                          </div>
                          {expandedDepts.includes(dept.id) ? <ChevronDown className="w-4 h-4 ml-auto" /> : <ChevronRight className="w-4 h-4 ml-auto" />}
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-muted-foreground/10">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={dept.head.image} />
                            <AvatarFallback>{dept.head.name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold">{isAr ? dept.head.nameAr : dept.head.name}</span>
                            <span className="text-[10px] text-muted-foreground">{isAr ? dept.head.roleAr : dept.head.role}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Sub-departments expansion */}
                    {expandedDepts.includes(dept.id) && dept.subDepts.length > 0 && (
                      <div className="mt-4 flex flex-col items-center gap-2 w-full animate-in fade-in slide-in-from-top-2">
                        <div className="w-px h-4 bg-muted-foreground/30" />
                        {dept.subDepts.map((sub, idx) => (
                          <div key={idx} className="w-full px-4">
                             <div className="bg-white/40 dark:bg-white/5 border rounded-lg p-2 text-[10px] font-medium text-center hover:bg-white/60 dark:hover:bg-white/10 transition-colors">
                               {sub}
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
             </div>
          </div>
          
          <div className="mt-12 text-sm text-muted-foreground flex items-center gap-2 italic">
            <AlertCircle className="w-4 h-4" />
            {isAr ? "انقر على القسم لعرض الأقسام الفرعية وفريق العمل" : "Click on a department to view sub-departments and team members"}
          </div>
        </div>
      </div>

      {/* Departments Details Table */}
      <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{isAr ? "تفاصيل الأقسام والمدراء" : "Departments & Managers Details"}</CardTitle>
            <CardDescription>{isAr ? "إحصائيات شاملة لكل قسم ونسب الإشغال" : "Comprehensive stats for each department and occupancy rates"}</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={isAr ? "بحث عن قسم..." : "Search departments..."} 
              className={isAr ? "pr-10" : "pl-10"} 
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-black/5 dark:bg-white/5">
              <TableRow>
                <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "القسم" : "Department"}</TableHead>
                <TableHead className={isAr ? "text-right" : "text-left"}>{isAr ? "مدير القسم" : "Department Head"}</TableHead>
                <TableHead className="text-center">{isAr ? "عدد الموظفين" : "Employees"}</TableHead>
                <TableHead className="text-center">{isAr ? "نسبة الإشغال" : "Occupancy"}</TableHead>
                <TableHead className="text-center">{isAr ? "الحالة" : "Status"}</TableHead>
                <TableHead className="text-center w-[80px]">{t("actions._value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((dept) => (
                <TableRow key={dept.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="bg-muted p-2 rounded-lg">
                        {dept.icon}
                      </div>
                      <span className="font-semibold text-sm">{dept.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={dept.head.image} />
                        <AvatarFallback>{dept.head.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{isAr ? dept.head.nameAr : dept.head.name}</span>
                        <span className="text-xs text-muted-foreground">{isAr ? dept.head.roleAr : dept.head.role}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium">{dept.employees}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-semibold">{dept.occupancy}</span>
                      <div className="w-16 h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full" 
                          style={{ width: dept.occupancy }} 
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-medium gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      {isAr ? "نشط" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
                          <MoreVertical className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>{t("team.orgChart.actions.deptOptions")}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2">
                            <Users className="w-4 h-4" /> {t("team.orgChart.actions.viewEmployees")}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <Plus className="w-4 h-4" /> {t("team.orgChart.actions.addSubDept")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2 text-red-600 focus:text-red-600">
                             {t("team.orgChart.actions.deactivateDept")}
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
