/**
 * Navigation configuration with role-based access control
 */

import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Briefcase,
  Calendar,
  Route,
  UserCog,
  Settings,
  Mail,
  GitBranch,
  Megaphone,
  Inbox,
  LucideIcon,
} from 'lucide-react';
import type { AppRole } from './permissions';

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  minRole: AppRole;
  badge?: number;
  children?: NavItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Main navigation items with minimum role requirements
 */
export const MAIN_NAV_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/',
    icon: LayoutDashboard,
    minRole: 'viewer',
  },
  {
    title: 'Calendar',
    url: '/calendar',
    icon: Calendar,
    minRole: 'viewer',
  },
  {
    title: 'Jobs',
    url: '/jobs',
    icon: Briefcase,
    minRole: 'viewer',
  },
  {
    title: 'Customers',
    url: '/customers',
    icon: Users,
    minRole: 'technician',
  },
  {
    title: 'Quotes',
    url: '/quotes',
    icon: FileText,
    minRole: 'admin',
  },
  {
    title: 'Invoices',
    url: '/invoices',
    icon: Receipt,
    minRole: 'admin',
  },
  {
    title: 'Requests',
    url: '/requests',
    icon: Inbox,
    minRole: 'admin',
  },
  {
    title: 'Team',
    url: '/team',
    icon: UserCog,
    minRole: 'technician', // Technicians can see their own timesheets
  },
  {
    title: 'Routes',
    url: '/routes',
    icon: Route,
    minRole: 'admin',
  },
];

/**
 * Marketing navigation items
 */
export const MARKETING_NAV_ITEMS: NavItem[] = [
  {
    title: 'Templates',
    url: '/marketing/templates',
    icon: Mail,
    minRole: 'admin',
  },
  {
    title: 'Sequences',
    url: '/marketing/sequences',
    icon: GitBranch,
    minRole: 'admin',
  },
  {
    title: 'Campaigns',
    url: '/marketing/campaigns',
    icon: Megaphone,
    minRole: 'admin',
  },
];

/**
 * Settings navigation items
 */
export const SETTINGS_NAV_ITEMS: NavItem[] = [
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings,
    minRole: 'admin',
  },
];

/**
 * All navigation groups
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: MAIN_NAV_ITEMS,
  },
  {
    label: 'Marketing',
    items: MARKETING_NAV_ITEMS,
  },
  {
    label: 'System',
    items: SETTINGS_NAV_ITEMS,
  },
];

/**
 * Get flattened list of all nav items
 */
export function getAllNavItems(): NavItem[] {
  return NAV_GROUPS.flatMap(group => group.items);
}
