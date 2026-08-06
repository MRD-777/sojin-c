"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";

const routeMap: Record<string, string> = {
  dashboard: "nav.dashboard",
  projects: "nav.projects",
  finance: "nav.finance",
  team: "nav.team",
  subcontractors: "nav.subcontractors",
  chat: "nav.chat",
  settings: "nav.settings",
  profile: "nav.profile",
  audit: "nav.auditTrail",
  reports: "nav.reports",
  new: "dashboardPage.projects.newProject",
  reviews: "nav.reviewInbox",
  sla: "nav.slaTracker",
  reconciliation: "nav.reconciliation",
  payments: "nav.payments",
  invoices: "nav.invoices",
  profitability: "nav.profitability",
  permissions: "nav.permissions",
  assignments: "nav.assignments",
  performance: "nav.performance",
  subscription: "nav.subscription",
  workflow: "nav.workflow",
};

export interface BreadcrumbItem {
  label: string;
  href: string;
}

export interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps = {}) {
  const pathname = usePathname();
  const t = useTranslations("Common");

  let crumbs = [];

  if (items && items.length > 0) {
    crumbs = items.map((item, index) => ({
      href: item.href,
      label: item.label,
      isLast: index === items.length - 1,
      segment: item.href.split("/").pop() || "",
    }));
  } else {
    // Remove locale prefix and split
    const segments = pathname
      .replace(/^\/(ar|en)\//, "")
      .split("/")
      .filter(Boolean);

    if (segments.length <= 1) return null;

    crumbs = segments.map((segment, index) => {
      const href = "/" + segments.slice(0, index + 1).join("/");
      const translationKey = routeMap[segment];
      const label = translationKey ? t(translationKey) : segment;
      const isLast = index === segments.length - 1;

      return { href, label, isLast, segment };
    });
  }

  if (crumbs.length === 0) return null;



  return (
    <nav className="flex items-center gap-1.5 text-xs text-[#999] dark:text-[#666] overflow-x-auto no-scrollbar pb-1">
      {crumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex items-center gap-1.5 shrink-0">
          {index > 0 && (
            <ChevronRight className="w-3 h-3 text-[#ccc] dark:text-[#555] rtl:rotate-180 shrink-0" />
          )}
          {crumb.isLast ? (
            <span className="font-semibold text-[#111] dark:text-white">
              {crumb.label}
            </span>
          ) : (
            <Link 
              href={crumb.href}
              className="hover:text-[#111] dark:hover:text-white transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
