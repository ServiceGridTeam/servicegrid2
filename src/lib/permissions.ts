/**
 * Role-based permission system for multi-business architecture
 */

export type AppRole = 'owner' | 'admin' | 'technician' | 'viewer';

/**
 * Role levels for comparison - higher number = more permissions
 */
export const ROLE_LEVELS: Record<AppRole, number> = {
  owner: 100,
  admin: 75,
  technician: 50,
  viewer: 25,
} as const;

/**
 * Role display configuration
 */
export const ROLE_CONFIG: Record<AppRole, { label: string; color: string; description: string }> = {
  owner: {
    label: 'Owner',
    color: 'hsl(var(--chart-1))',
    description: 'Full access to all features and settings',
  },
  admin: {
    label: 'Admin',
    color: 'hsl(var(--chart-2))',
    description: 'Manage team, jobs, quotes, invoices, and settings',
  },
  technician: {
    label: 'Technician',
    color: 'hsl(var(--chart-3))',
    description: 'View and work on assigned jobs, manage own time',
  },
  viewer: {
    label: 'Viewer',
    color: 'hsl(var(--chart-4))',
    description: 'Read-only access to jobs and calendar',
  },
} as const;

/**
 * Check if a user role meets the minimum required role
 */
export function hasMinRole(userRole: AppRole | null | undefined, minRole: AppRole): boolean {
  if (!userRole) return false;
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[minRole];
}

/**
 * Check if user can perform a specific action
 */
export function canPerformAction(
  userRole: AppRole | null | undefined,
  action: 'manage_team' | 'manage_settings' | 'manage_billing' | 'view_jobs' | 'edit_jobs' | 'clock_in_out' | 'manage_tags' | 'tag_photos'
): boolean {
  if (!userRole) return false;

  const actionRoles: Record<typeof action, AppRole> = {
    manage_team: 'admin',
    manage_settings: 'admin',
    manage_billing: 'owner',
    view_jobs: 'viewer',
    edit_jobs: 'technician',
    clock_in_out: 'technician',
    manage_tags: 'admin', // Admin+ can create/edit/delete tags
    tag_photos: 'technician', // Technician+ can tag photos
  };

  return hasMinRole(userRole, actionRoles[action]);
}

/**
 * Query keys that are scoped to a specific business
 * These need to be invalidated when switching businesses
 */
export const BUSINESS_SCOPED_QUERY_KEYS = [
  'jobs',
  'customers',
  'quotes',
  'invoices',
  'team-members',
  'team-invites',
  'dashboard-stats',
  'notifications',
  'clock-events',
  'time-entries',
  'daily-route-plans',
  'campaigns',
  'email-templates',
  'email-sequences',
  'job-requests',
  'job-modification-requests',
  'reviews',
  'review-requests',
  'review-config',
  'review-request-stats',
  'technician-leaderboard',
] as const;
