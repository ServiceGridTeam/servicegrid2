/**
 * Type-safe Portal API wrapper
 * All portal API calls go through this module for consistency and error handling
 */

import { supabase } from '@/integrations/supabase/client';
import { getPortalSessionToken } from './portalLocalState';

// ============ Types ============

export interface PortalApiError {
  code: string;
  message: string;
}

export interface PortalApiResponse<T> {
  data: T | null;
  error: PortalApiError | null;
}

export interface MagicLinkResponse {
  success: boolean;
  message: string;
}

export interface ValidateMagicLinkResponse {
  sessionToken: string;
  customerAccountId: string;
  email: string;
  businesses: Array<{
    businessId: string;
    businessName: string;
    customerId: string;
    isPrimary: boolean;
    logoUrl: string | null;
    primaryColor: string | null;
  }>;
}

export interface PasswordLoginResponse {
  sessionToken: string;
  customerAccountId: string;
  email: string;
  businesses: Array<{
    businessId: string;
    businessName: string;
    customerId: string;
    isPrimary: boolean;
    logoUrl: string | null;
    primaryColor: string | null;
  }>;
}

export interface SessionValidationResponse {
  valid: boolean;
  customerAccountId: string;
  email: string;
  businesses: Array<{
    businessId: string;
    businessName: string;
    customerId: string;
    isPrimary: boolean;
    logoUrl: string | null;
    primaryColor: string | null;
  }>;
}

export interface DashboardData {
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
  recentActivity: Array<{
    id: string;
    type: 'quote' | 'invoice' | 'job';
    title: string;
    status: string;
    date: string;
  }>;
}

export interface QuoteActionResponse {
  success: boolean;
  newStatus: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  status?: string;
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface ServiceRequestResponse {
  id: string;
  requestNumber: string;
}

export interface FeedbackResponse {
  success: boolean;
}

// ============ Helper Functions ============

function getAuthHeaders(): Record<string, string> {
  const token = getPortalSessionToken();
  if (!token) {
    return {};
  }
  return {
    'X-Portal-Session': token,
  };
}

async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<PortalApiResponse<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers: getAuthHeaders(),
    });

    if (error) {
      return {
        data: null,
        error: {
          code: 'EDGE_FUNCTION_ERROR',
          message: error.message,
        },
      };
    }

    return { data: data as T, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error',
      },
    };
  }
}

// ============ Authentication API ============

export async function generateMagicLink(
  email: string,
  businessId?: string
): Promise<PortalApiResponse<MagicLinkResponse>> {
  return callEdgeFunction<MagicLinkResponse>('portal-auth', {
    action: 'generate-magic-link',
    email,
    businessId,
  });
}

export async function validateMagicLink(
  token: string
): Promise<PortalApiResponse<ValidateMagicLinkResponse>> {
  return callEdgeFunction<ValidateMagicLinkResponse>('portal-auth', {
    action: 'validate-magic-link',
    token,
  });
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<PortalApiResponse<PasswordLoginResponse>> {
  return callEdgeFunction<PasswordLoginResponse>('portal-auth', {
    action: 'login-password',
    email,
    password,
  });
}

export async function createPassword(
  password: string
): Promise<PortalApiResponse<{ success: boolean }>> {
  return callEdgeFunction<{ success: boolean }>('portal-auth', {
    action: 'create-password',
    password,
  });
}

export async function validateSession(): Promise<
  PortalApiResponse<SessionValidationResponse>
> {
  return callEdgeFunction<SessionValidationResponse>('portal-auth', {
    action: 'validate-session',
  });
}

export async function logout(): Promise<PortalApiResponse<{ success: boolean }>> {
  return callEdgeFunction<{ success: boolean }>('portal-auth', {
    action: 'logout',
  });
}

export async function refreshSession(): Promise<
  PortalApiResponse<{ sessionToken: string; expiresAt: string }>
> {
  return callEdgeFunction<{ sessionToken: string; expiresAt: string }>(
    'portal-auth',
    {
      action: 'refresh-session',
    }
  );
}

// ============ Dashboard API ============

export async function fetchDashboardData(
  businessId: string,
  customerId: string
): Promise<PortalApiResponse<DashboardData>> {
  // Direct Supabase queries for dashboard data
  try {
    const token = getPortalSessionToken();
    if (!token) {
      return {
        data: null,
        error: { code: 'NO_SESSION', message: 'No active session' },
      };
    }

    // Fetch quotes
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('id, status')
      .eq('customer_id', customerId)
      .eq('business_id', businessId);

    if (quotesError) throw quotesError;

    // Fetch invoices
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, status, total')
      .eq('customer_id', customerId)
      .eq('business_id', businessId);

    if (invoicesError) throw invoicesError;

    // Fetch jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, status, scheduled_start')
      .eq('customer_id', customerId)
      .eq('business_id', businessId)
      .order('scheduled_start', { ascending: true });

    if (jobsError) throw jobsError;

    const pendingQuotes = quotes?.filter((q) => q.status === 'Sent').length || 0;
    const unpaidInvoices =
      invoices?.filter((i) => i.status === 'Sent' || i.status === 'Overdue')
        .length || 0;
    const activeJobs =
      jobs?.filter(
        (j) =>
          j.status === 'Scheduled' ||
          j.status === 'In Progress' ||
          j.status === 'En Route'
      ).length || 0;
    const totalOwed =
      invoices
        ?.filter((i) => i.status === 'Sent' || i.status === 'Overdue')
        .reduce((sum, i) => sum + (i.total || 0), 0) || 0;

    const upcomingJobs = (jobs || [])
      .filter(
        (j) =>
          j.scheduled_start &&
          new Date(j.scheduled_start) >= new Date() &&
          j.status !== 'Completed' &&
          j.status !== 'Cancelled'
      )
      .slice(0, 5)
      .map((j) => ({
        id: j.id,
        title: j.title,
        scheduledDate: j.scheduled_start || '',
        status: j.status,
      }));

    return {
      data: {
        pendingQuotes,
        unpaidInvoices,
        activeJobs,
        totalOwed,
        upcomingJobs,
        recentActivity: [], // TODO: Implement activity log query
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'FETCH_ERROR',
        message: err instanceof Error ? err.message : 'Failed to fetch dashboard',
      },
    };
  }
}

// ============ Quote Actions API ============

export async function approveQuote(
  quoteId: string
): Promise<PortalApiResponse<QuoteActionResponse>> {
  return callEdgeFunction<QuoteActionResponse>('portal-quotes', {
    action: 'approve',
    quoteId,
  });
}

export async function declineQuote(
  quoteId: string,
  reason?: string
): Promise<PortalApiResponse<QuoteActionResponse>> {
  return callEdgeFunction<QuoteActionResponse>('portal-quotes', {
    action: 'decline',
    quoteId,
    reason,
  });
}

export async function requestQuoteChanges(
  quoteId: string,
  notes: string
): Promise<PortalApiResponse<QuoteActionResponse>> {
  return callEdgeFunction<QuoteActionResponse>('portal-quotes', {
    action: 'request-changes',
    quoteId,
    notes,
  });
}

// ============ Payment API ============

export async function createPaymentIntent(
  invoiceId: string,
  paymentMethodId?: string
): Promise<PortalApiResponse<PaymentIntentResponse>> {
  return callEdgeFunction<PaymentIntentResponse>('portal-payment-methods', {
    action: 'create-payment-intent',
    invoiceId,
    paymentMethodId,
  });
}

export async function listPaymentMethods(): Promise<
  PortalApiResponse<PaymentMethod[]>
> {
  return callEdgeFunction<PaymentMethod[]>('portal-payment-methods', {
    action: 'list',
  });
}

export async function setDefaultPaymentMethod(
  paymentMethodId: string
): Promise<PortalApiResponse<{ success: boolean }>> {
  return callEdgeFunction<{ success: boolean }>('portal-payment-methods', {
    action: 'set-default',
    paymentMethodId,
  });
}

export async function deletePaymentMethod(
  paymentMethodId: string
): Promise<PortalApiResponse<{ success: boolean }>> {
  return callEdgeFunction<{ success: boolean }>('portal-payment-methods', {
    action: 'delete',
    paymentMethodId,
  });
}

export async function createSetupIntent(): Promise<
  PortalApiResponse<{ clientSecret: string }>
> {
  return callEdgeFunction<{ clientSecret: string }>('portal-payment-methods', {
    action: 'create-setup-intent',
  });
}

// ============ Service Request API ============

export async function submitServiceRequest(
  businessId: string,
  customerId: string,
  data: {
    serviceType: string;
    description: string;
    urgency: 'low' | 'normal' | 'high' | 'emergency';
    preferredTimes?: string[];
    photoUrls?: string[];
  }
): Promise<PortalApiResponse<ServiceRequestResponse>> {
  return callEdgeFunction<ServiceRequestResponse>('portal-service-requests', {
    action: 'submit',
    businessId,
    customerId,
    ...data,
  });
}

export async function uploadServiceRequestPhoto(
  file: File
): Promise<PortalApiResponse<{ url: string }>> {
  try {
    const token = getPortalSessionToken();
    if (!token) {
      return {
        data: null,
        error: { code: 'NO_SESSION', message: 'No active session' },
      };
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `service-requests/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('customer-uploads')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('customer-uploads')
      .getPublicUrl(filePath);

    return { data: { url: urlData.publicUrl }, error: null };
  } catch (err) {
    return {
      data: null,
      error: {
        code: 'UPLOAD_ERROR',
        message: err instanceof Error ? err.message : 'Upload failed',
      },
    };
  }
}

// ============ Feedback API ============

export async function submitFeedback(
  jobId: string,
  data: {
    rating: number;
    comment?: string;
    technicianRating?: number;
    timelinessRating?: number;
    qualityRating?: number;
  }
): Promise<PortalApiResponse<FeedbackResponse>> {
  return callEdgeFunction<FeedbackResponse>('portal-feedback', {
    action: 'submit',
    jobId,
    ...data,
  });
}

export async function getPendingFeedback(
  customerId: string
): Promise<
  PortalApiResponse<Array<{ jobId: string; jobTitle: string; completedAt: string }>>
> {
  return callEdgeFunction<
    Array<{ jobId: string; jobTitle: string; completedAt: string }>
  >('portal-feedback', {
    action: 'get-pending',
    customerId,
  });
}
