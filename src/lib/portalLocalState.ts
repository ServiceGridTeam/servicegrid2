/**
 * Portal local state persistence for instant hydration
 * Stores customer portal context in localStorage for zero-latency initial render
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const PORTAL_STORAGE_KEYS = {
  SESSION_TOKEN: 'sg_portal_session_token',
  ACTIVE_BUSINESS_ID: 'sg_portal_active_business_id',
  ACTIVE_CUSTOMER_ID: 'sg_portal_active_customer_id',
  CUSTOMER_ACCOUNT_ID: 'sg_portal_customer_account_id',
  BUSINESSES: 'sg_portal_businesses',
  BUSINESSES_TIMESTAMP: 'sg_portal_businesses_ts',
  DASHBOARD_CACHE: 'sg_portal_dashboard_cache',
  DASHBOARD_CACHE_TIMESTAMP: 'sg_portal_dashboard_cache_ts',
  UNREAD_COUNT: 'sg_portal_unread_count',
} as const;

export interface StoredPortalBusiness {
  businessId: string;
  businessName: string;
  customerId: string;
  isPrimary: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
}

export interface StoredDashboardCache {
  pendingQuotes: number;
  unpaidInvoices: number;
  activeJobs: number;
  totalOwed: number;
  upcomingJobs: Array<{
    id: string;
    title: string;
    scheduledDate: string;
    status: string;
  }>;
}

// ============ Session Token ============

export function getPortalSessionToken(): string | null {
  try {
    return localStorage.getItem(PORTAL_STORAGE_KEYS.SESSION_TOKEN);
  } catch {
    return null;
  }
}

export function setPortalSessionToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(PORTAL_STORAGE_KEYS.SESSION_TOKEN, token);
    } else {
      localStorage.removeItem(PORTAL_STORAGE_KEYS.SESSION_TOKEN);
    }
  } catch {
    // Ignore storage errors
  }
}

// ============ Active Business Context ============

export function getPortalActiveBusiness(): string | null {
  try {
    return localStorage.getItem(PORTAL_STORAGE_KEYS.ACTIVE_BUSINESS_ID);
  } catch {
    return null;
  }
}

export function setPortalActiveBusiness(businessId: string | null): void {
  try {
    if (businessId) {
      localStorage.setItem(PORTAL_STORAGE_KEYS.ACTIVE_BUSINESS_ID, businessId);
    } else {
      localStorage.removeItem(PORTAL_STORAGE_KEYS.ACTIVE_BUSINESS_ID);
    }
  } catch {
    // Ignore storage errors
  }
}

// ============ Active Customer Context ============

export function getPortalActiveCustomer(): string | null {
  try {
    return localStorage.getItem(PORTAL_STORAGE_KEYS.ACTIVE_CUSTOMER_ID);
  } catch {
    return null;
  }
}

export function setPortalActiveCustomer(customerId: string | null): void {
  try {
    if (customerId) {
      localStorage.setItem(PORTAL_STORAGE_KEYS.ACTIVE_CUSTOMER_ID, customerId);
    } else {
      localStorage.removeItem(PORTAL_STORAGE_KEYS.ACTIVE_CUSTOMER_ID);
    }
  } catch {
    // Ignore storage errors
  }
}

// ============ Customer Account ID ============

export function getPortalCustomerAccountId(): string | null {
  try {
    return localStorage.getItem(PORTAL_STORAGE_KEYS.CUSTOMER_ACCOUNT_ID);
  } catch {
    return null;
  }
}

export function setPortalCustomerAccountId(accountId: string | null): void {
  try {
    if (accountId) {
      localStorage.setItem(PORTAL_STORAGE_KEYS.CUSTOMER_ACCOUNT_ID, accountId);
    } else {
      localStorage.removeItem(PORTAL_STORAGE_KEYS.CUSTOMER_ACCOUNT_ID);
    }
  } catch {
    // Ignore storage errors
  }
}

// ============ Businesses Cache ============

export function getPortalBusinesses(): StoredPortalBusiness[] {
  try {
    const timestamp = localStorage.getItem(PORTAL_STORAGE_KEYS.BUSINESSES_TIMESTAMP);
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp, 10);
      if (age > CACHE_TTL_MS) {
        localStorage.removeItem(PORTAL_STORAGE_KEYS.BUSINESSES);
        localStorage.removeItem(PORTAL_STORAGE_KEYS.BUSINESSES_TIMESTAMP);
        return [];
      }
    }

    const raw = localStorage.getItem(PORTAL_STORAGE_KEYS.BUSINESSES);
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

export function setPortalBusinesses(businesses: StoredPortalBusiness[]): void {
  try {
    localStorage.setItem(PORTAL_STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    localStorage.setItem(PORTAL_STORAGE_KEYS.BUSINESSES_TIMESTAMP, Date.now().toString());
  } catch {
    // Ignore storage errors
  }
}

// ============ Dashboard Cache ============

export function getPortalDashboardCache(): StoredDashboardCache | null {
  try {
    const timestamp = localStorage.getItem(PORTAL_STORAGE_KEYS.DASHBOARD_CACHE_TIMESTAMP);
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp, 10);
      if (age > CACHE_TTL_MS) {
        localStorage.removeItem(PORTAL_STORAGE_KEYS.DASHBOARD_CACHE);
        localStorage.removeItem(PORTAL_STORAGE_KEYS.DASHBOARD_CACHE_TIMESTAMP);
        return null;
      }
    }

    const raw = localStorage.getItem(PORTAL_STORAGE_KEYS.DASHBOARD_CACHE);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setPortalDashboardCache(cache: StoredDashboardCache): void {
  try {
    localStorage.setItem(PORTAL_STORAGE_KEYS.DASHBOARD_CACHE, JSON.stringify(cache));
    localStorage.setItem(PORTAL_STORAGE_KEYS.DASHBOARD_CACHE_TIMESTAMP, Date.now().toString());
  } catch {
    // Ignore storage errors
  }
}

export function invalidatePortalDashboardCache(): void {
  try {
    localStorage.removeItem(PORTAL_STORAGE_KEYS.DASHBOARD_CACHE);
    localStorage.removeItem(PORTAL_STORAGE_KEYS.DASHBOARD_CACHE_TIMESTAMP);
  } catch {
    // Ignore storage errors
  }
}

// ============ Unread Count ============

export function getPortalUnreadCount(): number {
  try {
    const raw = localStorage.getItem(PORTAL_STORAGE_KEYS.UNREAD_COUNT);
    if (!raw) return 0;
    return parseInt(raw, 10) || 0;
  } catch {
    return 0;
  }
}

export function setPortalUnreadCount(count: number): void {
  try {
    localStorage.setItem(PORTAL_STORAGE_KEYS.UNREAD_COUNT, count.toString());
  } catch {
    // Ignore storage errors
  }
}

// ============ Context Helpers ============

export function updatePortalContext(
  businessId: string,
  customerId: string,
  accountId: string
): void {
  setPortalActiveBusiness(businessId);
  setPortalActiveCustomer(customerId);
  setPortalCustomerAccountId(accountId);
}

export function getPortalContext(): {
  sessionToken: string | null;
  activeBusinessId: string | null;
  activeCustomerId: string | null;
  customerAccountId: string | null;
  businesses: StoredPortalBusiness[];
  dashboardCache: StoredDashboardCache | null;
  unreadCount: number;
} {
  return {
    sessionToken: getPortalSessionToken(),
    activeBusinessId: getPortalActiveBusiness(),
    activeCustomerId: getPortalActiveCustomer(),
    customerAccountId: getPortalCustomerAccountId(),
    businesses: getPortalBusinesses(),
    dashboardCache: getPortalDashboardCache(),
    unreadCount: getPortalUnreadCount(),
  };
}

// ============ Clear All ============

export function clearPortalLocalState(): void {
  try {
    Object.values(PORTAL_STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch {
    // Ignore storage errors
  }
}
