/**
 * Pre-computed navigation by role for instant rendering
 * Avoids filtering on every render
 */

import type { AppRole } from './permissions';
import { hasMinRole } from './permissions';
import { NAV_GROUPS, type NavGroup, type NavItem } from './navigation';

/**
 * Filter nav items by role
 */
function filterNavItems(items: NavItem[], role: AppRole): NavItem[] {
  return items.filter(item => hasMinRole(role, item.minRole));
}

/**
 * Filter nav groups by role
 */
function filterNavGroups(groups: NavGroup[], role: AppRole): NavGroup[] {
  return groups
    .map(group => ({
      ...group,
      items: filterNavItems(group.items, role),
    }))
    .filter(group => group.items.length > 0);
}

/**
 * Pre-computed navigation for each role
 * This is computed once at module load time
 */
export const NAV_BY_ROLE: Record<AppRole, NavGroup[]> = {
  owner: filterNavGroups(NAV_GROUPS, 'owner'),
  admin: filterNavGroups(NAV_GROUPS, 'admin'),
  technician: filterNavGroups(NAV_GROUPS, 'technician'),
  viewer: filterNavGroups(NAV_GROUPS, 'viewer'),
} as const;

/**
 * Get pre-computed nav for a role
 * Falls back to viewer if role is invalid
 */
export function getNavForRole(role: AppRole | null | undefined): NavGroup[] {
  if (!role || !(role in NAV_BY_ROLE)) {
    return NAV_BY_ROLE.viewer;
  }
  return NAV_BY_ROLE[role];
}

/**
 * Get the default route for a role
 * Used for redirecting after login or business switch
 */
export function getDefaultRouteForRole(role: AppRole | null | undefined): string {
  // Everyone can access dashboard
  return '/';
}

/**
 * Check if a route is accessible for a role
 */
export function isRouteAccessible(route: string, role: AppRole | null | undefined): boolean {
  if (!role) return false;
  
  const allItems = NAV_BY_ROLE[role].flatMap(group => group.items);
  
  // Check exact match or prefix match for nested routes
  return allItems.some(item => {
    if (route === item.url) return true;
    if (route.startsWith(item.url + '/')) return true;
    return false;
  });
}
