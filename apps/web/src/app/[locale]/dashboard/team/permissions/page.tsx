"use client";

import { useTranslations, useLocale } from "next-intl";
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Users, 
  Settings, 
  Lock, 
  Eye, 
  Edit3, 
  Plus, 
  Trash2,
  Check,
  X,
  Search,
  MoreVertical,
  Key
} from "lucide-react";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

export default function PermissionsPage() {
  const t = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [selectedRole, setSelectedRole] = useState("projectManager");

  const roles = [
    { id: "admin", name: t("permissions.roles.admin"), users: 3, type: "System" },
    { id: "projectManager", name: t("permissions.roles.projectManager"), users: 12, type: "Enterprise" },
    { id: "siteEngineer", name: t("permissions.roles.siteEngineer"), users: 45, type: "Operational" },
    { id: "finance", name: t("permissions.roles.finance"), users: 5, type: "Administrative" },
    { id: "hr", name: t("permissions.roles.hr"), users: 4, type: "Administrative" },
    { id: "safetyOfficer", name: t("permissions.roles.safetyOfficer"), users: 18, type: "Safety" }
  ];

  const modules = [
    { id: "projects", name: t("permissions.modules.projects") },
    { id: "finance", name: t("permissions.modules.finance") },
    { id: "team", name: t("permissions.modules.team") },
    { id: "inventory", name: t("permissions.modules.inventory") },
    { id: "reports", name: t("permissions.modules.reports") }
  ];

  const actions = ["view", "create", "edit", "delete", "approve"];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Breadcrumbs 
            items={[
              { label: t("nav.dashboard"), href: "/dashboard" },
              { label: t("nav.team"), href: "/dashboard/team" },
              { label: t("permissions.title"), href: "/dashboard/team/permissions" }
            ]} 
          />
          <h1 className="text-2xl font-bold tracking-tight mt-1">{t("permissions.title")}</h1>
          <p className="text-muted-foreground">{t("permissions.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Lock className="w-4 h-4" />
            {isAr ? "سجل الأمان" : "Security Logs"}
          </Button>
          <Button className="gap-2 bg-[#111] hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black">
            <Plus className="w-4 h-4" />
            {isAr ? "إنشاء دور جديد" : "Create New Role"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111]">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-black/5 dark:bg-white/5 p-3 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("permissions.stats.totalRoles")}</p>
              <h3 className="text-2xl font-bold">8</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111]">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-black/5 dark:bg-white/5 p-3 rounded-xl">
              <Key className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("permissions.stats.customPermissions")}</p>
              <h3 className="text-2xl font-bold">124</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111]">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-black/5 dark:bg-white/5 p-3 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("permissions.stats.activePolicies")}</p>
              <h3 className="text-2xl font-bold">14</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Roles List */}
        <Card className="lg:col-span-4 border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111] h-fit">
          <CardHeader>
            <CardTitle className="text-lg font-bold">{isAr ? "أدوار المستخدمين" : "User Roles"}</CardTitle>
            <CardDescription>{isAr ? "اختر دوراً لتعديل صلاحياته" : "Select a role to modify its permissions"}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 p-4 pt-0">
            {roles.map((role) => (
              <div 
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`
                  flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all
                  ${selectedRole === role.id 
                    ? 'border-black/20 dark:border-white/20 bg-black/5 dark:bg-white/5 ring-1 ring-black/10 dark:ring-white/10' 
                    : 'border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${selectedRole === role.id ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-muted text-muted-foreground'}`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{role.name}</span>
                    <span className="text-[10px] text-muted-foreground">{role.type} • {role.users} {isAr ? "مستخدم" : "Users"}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Settings className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Permission Matrix */}
        <Card className="lg:col-span-8 border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold">
                {isAr ? "مصفوفة الصلاحيات لـ" : "Permission Matrix for"} {roles.find(r => r.id === selectedRole)?.name}
              </CardTitle>
              <CardDescription>{isAr ? "تحديد مستويات الوصول الدقيقة لكل نموذج" : "Set granular access levels for each module"}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">{isAr ? "إعادة تعيين" : "Reset"}</Button>
              <Button size="sm" className="bg-[#111] hover:bg-black text-white dark:bg-white dark:hover:bg-gray-100 dark:text-black">{isAr ? "حفظ التغييرات" : "Save Changes"}</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-black/5 dark:bg-white/5">
                  <TableRow>
                    <TableHead className={`w-[200px] ${isAr ? 'text-right' : 'text-left'}`}>{isAr ? "الموديول / الوحدة" : "Module / Feature"}</TableHead>
                    {actions.map((action) => (
                      <TableHead key={action} className="text-center capitalize">
                        {t(`permissions.actions.${action}`)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((mod) => (
                    <TableRow key={mod.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <TableCell className="font-semibold text-sm">{mod.name}</TableCell>
                      {actions.map((action) => (
                        <TableCell key={action} className="text-center">
                          <div className="flex justify-center">
                            <Checkbox 
                              defaultChecked={selectedRole === 'admin' || (selectedRole === 'projectManager' && action !== 'delete')}
                              className="w-4 h-4 rounded border-muted-foreground/30 data-[state=checked]:bg-black data-[state=checked]:border-black dark:data-[state=checked]:bg-white dark:data-[state=checked]:border-white dark:data-[state=checked]:text-black"
                            />
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="p-8 border-t border-white/5 bg-amber-500/5 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-amber-700 dark:text-amber-500">{isAr ? "تحذير أمني" : "Security Warning"}</span>
                <p className="text-xs text-amber-600 leading-relaxed">
                  {isAr 
                    ? "تغيير الصلاحيات سيؤثر فوراً على جميع المستخدمين المرتبطين بهذا الدور. سيتم تسجيل جميع التغييرات في سجل التدقيق الخاص بالنظام."
                    : "Changing permissions will immediately affect all users associated with this role. All changes will be logged in the system audit trail."
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Assignment Section */}
      <Card className="border-black/5 dark:border-white/5 shadow-sm bg-[#fafafa] dark:bg-[#111] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">{isAr ? "تعيين الأدوار للموظفين" : "User Role Assignments"}</CardTitle>
            <CardDescription>{isAr ? "إدارة الموظفين المسندين لكل دور" : "Manage employees assigned to each role"}</CardDescription>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={isAr ? "بحث عن موظف..." : "Search employee..."} 
              className={isAr ? "pr-10" : "pl-10"} 
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-black/5 dark:bg-white/5">
              <TableRow>
                <TableHead className={isAr ? 'text-right' : 'text-left'}>{isAr ? "الموظف" : "Employee"}</TableHead>
                <TableHead className={isAr ? 'text-right' : 'text-left'}>{isAr ? "الدور الحالي" : "Current Role"}</TableHead>
                <TableHead className={isAr ? 'text-right' : 'text-left'}>{isAr ? "القسم" : "Department"}</TableHead>
                <TableHead className="text-center">{isAr ? "آخر وصول" : "Last Access"}</TableHead>
                <TableHead className="text-center">{isAr ? "الحالة" : "MFA Status"}</TableHead>
                <TableHead className="text-center w-[80px]">{t("actions._value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { name: "Ahmed Mansour", nameAr: "أحمد منصور", role: "Project Manager", dept: "Operations", last: "2 mins ago", mfa: true },
                { name: "Sarah El-Din", nameAr: "سارة الدين", role: "Finance Manager", dept: "Finance", last: "1 hour ago", mfa: true },
                { name: "Michael Chen", nameAr: "مايكل تشن", role: "Site Engineer", dept: "Civil", last: "Yesterday", mfa: false },
                { name: "Fatima Hassan", nameAr: "فاطمة حسن", role: "HR Specialist", dept: "Human Resources", last: "5 hours ago", mfa: true }
              ].map((user, i) => (
                <TableRow key={i} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{user.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-semibold">{isAr ? user.nameAr : user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-black/10 dark:border-white/10 text-foreground bg-[#fafafa] dark:bg-[#111]">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{user.dept}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">{user.last}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-medium gap-1.5">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        user.mfa ? "bg-green-500" : "bg-red-500"
                      )} />
                      {user.mfa ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
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
