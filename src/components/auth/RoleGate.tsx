/**
 * Role-based access control wrapper component
 * Conditionally renders children based on user's role
 */

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { useBusinessContext } from "@/hooks/useBusinessContext";
import type { AppRole } from "@/lib/permissions";

interface RoleGateProps {
  /** Minimum role required to access the content */
  minRole: AppRole;
  /** Content to render if user has permission */
  children: ReactNode;
  /** Optional fallback content when access is denied */
  fallback?: ReactNode;
  /** Optional redirect path when access is denied */
  redirectTo?: string;
  /** Show nothing while loading (default: true) */
  hideWhileLoading?: boolean;
}

/**
 * Restricts access to content based on user's role in the active business
 * 
 * @example
 * // Show nothing if not admin
 * <RoleGate minRole="admin">
 *   <AdminPanel />
 * </RoleGate>
 * 
 * @example
 * // Show fallback message if not owner
 * <RoleGate minRole="owner" fallback={<p>Owners only</p>}>
 *   <OwnerSettings />
 * </RoleGate>
 * 
 * @example
 * // Redirect to dashboard if not admin
 * <RoleGate minRole="admin" redirectTo="/dashboard">
 *   <SettingsPage />
 * </RoleGate>
 */
export function RoleGate({
  minRole,
  children,
  fallback = null,
  redirectTo,
  hideWhileLoading = true,
}: RoleGateProps) {
  const { allowed, isLoading } = usePermission(minRole);
  const { activeBusinessId } = useBusinessContext();

  // Show nothing while loading (prevents flash of unauthorized content)
  if (isLoading && hideWhileLoading) {
    return null;
  }

  // No active business - can't determine permissions
  if (!activeBusinessId) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return <>{fallback}</>;
  }

  // User has required permission
  if (allowed) {
    return <>{children}</>;
  }

  // Access denied - redirect or show fallback
  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{fallback}</>;
}

/**
 * Hook version for programmatic permission checks
 * Use RoleGate component for declarative access control
 */
export { usePermission } from "@/hooks/usePermission";
