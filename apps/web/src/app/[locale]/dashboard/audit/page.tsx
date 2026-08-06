"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Filter, Download, FileText, ChevronDown, ChevronRight, History, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/dashboard/global/breadcrumbs";

export default function AuditTrailPage() {
  const t = useTranslations("Common");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const auditData = [
    {
      id: "AUD-001",
      date: "2026-04-25 10:30 AM",
      user: { name: t("dashboardPage.audit.mock.user1"), role: t("dashboardPage.audit.mock.role1"), initials: "AA" },
      action: t("dashboardPage.audit.actionCreate"),
      actionType: "create",
      description: t("dashboardPage.audit.mock.desc1"),
      entity: t("dashboardPage.audit.mock.entity1"),
      diff: {
        status: { old: null, new: t("dashboardPage.audit.mock.statusPlanning") },
        budget: { old: null, new: "$5,000,000" }
      }
    },
    {
      id: "AUD-002",
      date: "2026-04-25 09:15 AM",
      user: { name: t("dashboardPage.audit.mock.user2"), role: t("dashboardPage.audit.mock.role2"), initials: "SH" },
      action: t("dashboardPage.audit.actionApprove"),
      actionType: "approve",
      description: t("dashboardPage.audit.mock.desc2"),
      entity: t("dashboardPage.audit.mock.entity2"),
      diff: {
        status: { old: t("dashboardPage.audit.mock.statusPending"), new: t("dashboardPage.audit.mock.statusApproved") },
        approvedBy: { old: null, new: t("dashboardPage.audit.mock.user2") }
      }
    },
    {
      id: "AUD-003",
      date: "2026-04-24 16:45 PM",
      user: { name: t("dashboardPage.audit.mock.user3"), role: t("dashboardPage.audit.mock.role3"), initials: "OZ" },
      action: t("dashboardPage.audit.actionUpdate"),
      actionType: "update",
      description: t("dashboardPage.audit.mock.desc3"),
      entity: t("dashboardPage.audit.mock.entity3"),
      diff: {
        progress: { old: "40%", new: "80%" },
        notes: { old: t("dashboardPage.audit.mock.notesOld"), new: t("dashboardPage.audit.mock.notesNew") }
      }
    },
    {
      id: "AUD-004",
      date: "2026-04-24 11:20 AM",
      user: { name: t("dashboardPage.audit.mock.user4"), role: t("dashboardPage.audit.mock.role4"), initials: "SA" },
      action: t("dashboardPage.audit.actionDelete"),
      actionType: "delete",
      description: t("dashboardPage.audit.mock.desc4"),
      entity: t("dashboardPage.audit.mock.entity4"),
      diff: {
        isActive: { old: t("dashboardPage.audit.mock.true"), new: t("dashboardPage.audit.mock.false") },
        deletedAt: { old: null, new: "2026-04-24T11:20:00Z" }
      }
    }
  ];

  const getActionBadgeClass = (type: string) => {
    switch (type) {
      case "create":
        return "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white border border-black/10 dark:border-white/20";
      case "update":
        return "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white border border-black/10 dark:border-white/20";
      case "delete":
        return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20";
      case "approve":
        return "bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white";
      default:
        return "bg-black/5 text-[#111] dark:bg-white/10 dark:text-white border border-black/10 dark:border-white/20";
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 px-3 sm:px-8 py-6 sm:py-8 w-full max-w-[1800px] mx-auto">
      <Breadcrumbs />
      <header className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111] dark:text-white flex items-center gap-2">
            <History className="w-8 h-8" />
            {t("dashboardPage.audit.title")}
          </h1>
          <p className="text-sm text-[#666] dark:text-[#999] mt-2 max-w-2xl">
            {t("dashboardPage.audit.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="border-black/10 dark:border-white/10 text-[#111] dark:text-white gap-2">
            <FileText className="w-4 h-4" />
            {t("dashboardPage.audit.exportPdf")}
          </Button>
          <Button className="bg-[#111] text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 gap-2">
            <Download className="w-4 h-4" />
            {t("dashboardPage.audit.exportExcel")}
          </Button>
        </div>
      </header>

      {/* Filters */}
      <Card className="border-black/5 dark:border-white/5">
        <CardContent className="p-4 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666] dark:text-[#999]" />
            <Input 
              placeholder={t("searchPlaceholder")} 
              className="pl-9 border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-black/10 dark:border-white/10 text-[#666] dark:text-[#999] gap-2">
              <Filter className="w-4 h-4" />
              {t("dashboardPage.audit.filterDate")}
            </Button>
            <Button variant="outline" className="border-black/10 dark:border-white/10 text-[#666] dark:text-[#999] gap-2">
              <Filter className="w-4 h-4" />
              {t("dashboardPage.audit.filterUser")}
            </Button>
            <Button variant="outline" className="border-black/10 dark:border-white/10 text-[#666] dark:text-[#999] gap-2">
              <Filter className="w-4 h-4" />
              {t("dashboardPage.audit.filterAction")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card className="border-black/5 dark:border-white/5">
        <CardHeader className="pb-4 border-b border-black/5 dark:border-white/5">
          <CardTitle className="text-lg text-[#111] dark:text-white">
            {t("dashboardPage.audit.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-start">
              <thead className="bg-[#fafafa] dark:bg-[#0a0a0a] border-b border-black/5 dark:border-white/5 text-[#666] dark:text-[#999]">
                <tr>
                  <th className="w-12 px-6 py-4"></th>
                  <th className="px-6 py-4 font-medium text-start">{t("dashboardPage.audit.colDate")}</th>
                  <th className="px-6 py-4 font-medium text-start">{t("dashboardPage.audit.colUser")}</th>
                  <th className="px-6 py-4 font-medium text-start">{t("dashboardPage.audit.colAction")}</th>
                  <th className="px-6 py-4 font-medium text-start">{t("dashboardPage.audit.colEntity")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {auditData.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr 
                      className={`hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer ${expandedRow === item.id ? 'bg-black/[0.02] dark:bg-white/[0.02]' : ''}`}
                      onClick={() => toggleRow(item.id)}
                    >
                      <td className="px-6 py-4 text-[#666] dark:text-[#999]">
                        {expandedRow === item.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-[#111] dark:text-white">{item.date}</div>
                        <div className="text-xs text-[#666] dark:text-[#999]">{item.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-[#111] dark:text-white border border-black/10 dark:border-white/20">
                            {item.user.initials}
                          </div>
                          <div>
                            <div className="font-semibold text-[#111] dark:text-white">{item.user.name}</div>
                            <div className="text-xs text-[#666] dark:text-[#999]">{item.user.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getActionBadgeClass(item.actionType)}`}>
                          {item.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[#111] dark:text-white">{item.description}</div>
                        <div className="text-xs text-[#666] dark:text-[#999] mt-0.5">{item.entity}</div>
                      </td>
                    </tr>
                    
                    {/* Expandable Details Row */}
                    {expandedRow === item.id && (
                      <tr className="bg-[#fafafa] dark:bg-[#050505]">
                        <td colSpan={5} className="px-14 py-6">
                          <div className="border border-black/10 dark:border-white/10 rounded-lg p-6 bg-white dark:bg-[#111]">
                            <h4 className="text-sm font-semibold text-[#111] dark:text-white mb-4">
                              {t("dashboardPage.audit.colChanges")}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {Object.entries(item.diff).map(([key, value]) => {
                                // Fallback to key name if translation doesn't exist
                                const fieldName = t.has(`dashboardPage.audit.fields.${key}`) 
                                  ? t(`dashboardPage.audit.fields.${key}`) 
                                  : key;
                                  
                                const oldVal = value.old || t("dashboardPage.audit.emptyValue");
                                const newVal = value.new || t("dashboardPage.audit.emptyValue");
                                
                                return (
                                  <div key={key} className="flex flex-col gap-3 p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#111] dark:bg-white"></div>
                                      <span className="text-sm font-semibold text-[#111] dark:text-white">
                                        {fieldName}
                                      </span>
                                    </div>
                                    
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
                                      <div className="flex-1 p-2 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5">
                                        <div className="text-[10px] uppercase text-red-600 dark:text-red-400 mb-1 font-bold">
                                          {t("dashboardPage.audit.oldValue")}
                                        </div>
                                        <div className="font-medium text-red-800 dark:text-red-300 line-through opacity-70">
                                          {oldVal}
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center justify-center text-[#666] dark:text-[#999]">
                                        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                                      </div>
                                      
                                      <div className="flex-1 p-2 rounded-lg border border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-500/5">
                                        <div className="text-[10px] uppercase text-green-600 dark:text-green-400 mb-1 font-bold">
                                          {t("dashboardPage.audit.newValue")}
                                        </div>
                                        <div className="font-medium text-green-800 dark:text-green-300">
                                          {newVal}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
