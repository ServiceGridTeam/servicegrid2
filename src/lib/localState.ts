/**
 * Local state persistence for instant hydration
 * Stores business context in localStorage for zero-latency initial render
 */

import type { AppRole } from './permissions';

const STORAGE_KEYS = {
  ACTIVE_BUSINESS_ID: 'sg_active_business_id',
  ACTIVE_ROLE: 'sg_active_role',
  MEMBERSHIPS: 'sg_memberships',
} as const;

export interface StoredMembership {
  id: string;
  businessId: string;
  businessName: string;
  role: AppRole;
  isPrimary: boolean;
}

/**
 * Get active business ID from localStorage
 */
export function getActiveBusiness(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID);
  } catch {
    return null;
  }
}

/**
 * Set active business ID in localStorage
 */
export function setActiveBusiness(businessId: string | null): void {
  try {
    if (businessId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID, businessId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get active role from localStorage
 */
export function getActiveRole(): AppRole | null {
  try {
    const role = localStorage.getItem(STORAGE_KEYS.ACTIVE_ROLE);
    if (role && ['owner', 'admin', 'technician', 'viewer'].includes(role)) {
      return role as AppRole;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set active role in localStorage
 */
export function setActiveRole(role: AppRole | null): void {
  try {
    if (role) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, role);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_ROLE);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get cached memberships from localStorage
 */
export function getMemberships(): StoredMembership[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEMBERSHIPS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Set memberships in localStorage
 */
export function setMemberships(memberships: StoredMembership[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MEMBERSHIPS, JSON.stringify(memberships));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Update the active context in localStorage
 */
export function updateActiveContext(businessId: string, role: AppRole): void {
  setActiveBusiness(businessId);
  setActiveRole(role);
}

/**
 * Clear all local state (call on logout)
 */
export function clearLocalState(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ROLE);
    localStorage.removeItem(STORAGE_KEYS.MEMBERSHIPS);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get initial state for hydration
 * Returns null values if nothing is stored
 */
export function getInitialState(): {
  activeBusinessId: string | null;
  activeRole: AppRole | null;
  memberships: StoredMembership[];
} {
  return {
    activeBusinessId: getActiveBusiness(),
    activeRole: getActiveRole(),
    memberships: getMemberships(),
  };
}
