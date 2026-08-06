import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Wallet,
  Users,
  HardHat,
  MessageSquare,
  Settings,
  User,
} from 'lucide-react';

export type NavigationItem = {
  id: string;
  titleKey: string;
  href: string;
  icon?: React.ElementType;
  children?: NavigationItem[];
  roles?: string[]; // Array of roles allowed to see this item
};

export const primaryNavigation: NavigationItem[] = [
  {
    id: 'dashboard',
    titleKey: 'nav.dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'projects',
    titleKey: 'nav.projects',
    href: '/dashboard/projects',
    icon: Building2,
  },
  {
    id: 'finance',
    titleKey: 'nav.finance',
    href: '/dashboard/finance',
    icon: Wallet,
    roles: ['super_admin', 'accountant', 'project_manager'],
  },
  {
    id: 'team',
    titleKey: 'nav.team',
    href: '/dashboard/team',
    icon: Users,
    roles: ['super_admin', 'project_manager'],
  },
  {
    id: 'subcontractors',
    titleKey: 'nav.subcontractors',
    href: '/dashboard/subcontractors',
    icon: HardHat,
    roles: ['super_admin', 'project_manager', 'accountant'],
  },
  {
    id: 'chat',
    titleKey: 'nav.chat',
    href: '/dashboard/chat',
    icon: MessageSquare,
  },
];

export const bottomNavigation: NavigationItem[] = [
  {
    id: 'settings',
    titleKey: 'nav.settings',
    href: '/dashboard/settings',
    icon: Settings,
    roles: ['super_admin'],
  },
  {
    id: 'profile',
    titleKey: 'nav.profile',
    href: '/dashboard/profile',
    icon: User,
  },
];

export const secondaryNavigation: Record<string, NavigationItem[]> = {
  dashboard: [
    { id: 'overview', titleKey: 'nav.overview', href: '/dashboard' },
    { id: 'audit', titleKey: 'nav.auditTrail', href: '/dashboard/audit', roles: ['super_admin'] },
    { id: 'reports', titleKey: 'nav.reports', href: '/dashboard/reports' },
  ],
  projects: [
    { id: 'all_projects', titleKey: 'nav.allProjects', href: '/dashboard/projects' },
    { id: 'reviews', titleKey: 'nav.reviewInbox', href: '/dashboard/projects/reviews', roles: ['super_admin', 'project_manager'] },
    { id: 'sla', titleKey: 'nav.slaTracker', href: '/dashboard/projects/sla', roles: ['super_admin', 'project_manager'] },
  ],
  finance: [
    { id: 'fin_overview', titleKey: 'nav.finOverview', href: '/dashboard/finance' },
    { id: 'reconciliation', titleKey: 'nav.reconciliation', href: '/dashboard/finance/reconciliation' },
    { id: 'payments', titleKey: 'nav.payments', href: '/dashboard/finance/payments' },
    { id: 'petty_cash', titleKey: 'nav.pettyCash', href: '/dashboard/finance/petty-cash' },
    { id: 'invoices', titleKey: 'nav.invoices', href: '/dashboard/finance/invoices' },
    { id: 'profitability', titleKey: 'nav.profitability', href: '/dashboard/finance/profitability', roles: ['super_admin'] },
  ],
  team: [
    { id: 'all_employees', titleKey: 'nav.allEmployees', href: '/dashboard/team' },
    { id: 'org_chart', titleKey: 'nav.orgChart', href: '/dashboard/team/org-chart' },
    { id: 'attendance', titleKey: 'nav.attendance', href: '/dashboard/team/attendance' },
    { id: 'permissions', titleKey: 'nav.permissions', href: '/dashboard/team/permissions', roles: ['super_admin'] },
    { id: 'assignments', titleKey: 'nav.assignments', href: '/dashboard/team/assignments' },
    { id: 'performance', titleKey: 'nav.performance', href: '/dashboard/team/performance' },
    { id: 'training', titleKey: 'nav.training', href: '/dashboard/team/training' },
    { id: 'leaves', titleKey: 'nav.leaves', href: '/dashboard/team/leaves' },
    { id: 'safety', titleKey: 'nav.safety', href: '/dashboard/team/safety' },
  ],
  subcontractors: [
    { id: 'all_subs', titleKey: 'nav.allSubcontractors', href: '/dashboard/subcontractors' },
    { id: 'sub_payments', titleKey: 'nav.subPayments', href: '/dashboard/subcontractors/payments' },
    { id: 'compare', titleKey: 'nav.comparePrices', href: '/dashboard/subcontractors/compare' },
  ],
  chat: [
    { id: 'all_chats', titleKey: 'nav.allChats', href: '/dashboard/chat' },
  ],
  settings: [
    { id: 'company_info', titleKey: 'nav.companyInfo', href: '/dashboard/settings' },
    { id: 'subscription', titleKey: 'nav.subscription', href: '/dashboard/settings/subscription' },
    { id: 'workflow', titleKey: 'nav.workflow', href: '/dashboard/settings/workflow' },
  ],
};
