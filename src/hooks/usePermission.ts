/**
 * Simple permission check hook
 */

import { useMemo } from 'react';
import type { AppRole } from '@/lib/permissions';
import { hasMinRole } from '@/lib/permissions';
import { useBusinessContext } from './useBusinessContext';

interface UsePermissionResult {
  allowed: boolean;
  isLoading: boolean;
}

/**
 * Check if current user has at least the specified role
 */
export function usePermission(minRole: AppRole): UsePermissionResult {
  const { activeRole, isLoading } = useBusinessContext();

  const allowed = useMemo(() => {
    return hasMinRole(activeRole, minRole);
  }, [activeRole, minRole]);

  return {
    allowed,
    isLoading,
  };
}

/**
 * Check multiple permissions at once
 */
export function usePermissions(roles: AppRole[]): Record<AppRole, boolean> & { isLoading: boolean } {
  const { activeRole, isLoading } = useBusinessContext();

  const permissions = useMemo(() => {
    const result: Record<string, boolean> = { isLoading };
    roles.forEach((role) => {
      result[role] = hasMinRole(activeRole, role);
    });
    return result as Record<AppRole, boolean> & { isLoading: boolean };
  }, [activeRole, isLoading, roles]);

  return permissions;
}
