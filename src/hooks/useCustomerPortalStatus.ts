import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerPortalStatus {
  customerId: string;
  hasPortalAccess: boolean;
  lastInviteSentAt: string | null;
  inviteCount: number;
  pendingInvite: boolean;
}

export function useCustomerPortalStatus(customerIds: string[]) {
  return useQuery({
    queryKey: ["customer-portal-status", customerIds],
    queryFn: async () => {
      if (customerIds.length === 0) return {};

      // Fetch account links
      const { data: links } = await supabase
        .from("customer_account_links")
        .select("customer_id, status")
        .in("customer_id", customerIds)
        .eq("status", "active");

      // Fetch invites
      const { data: invites } = await supabase
        .from("customer_portal_invites")
        .select("customer_id, sent_at, status, expires_at")
        .in("customer_id", customerIds)
        .order("created_at", { ascending: false });

      const statusMap: Record<string, CustomerPortalStatus> = {};

      for (const id of customerIds) {
        const hasActiveLink = links?.some((l) => l.customer_id === id) ?? false;
        const customerInvites = invites?.filter((i) => i.customer_id === id) ?? [];
        const lastInvite = customerInvites[0];
        const hasPendingInvite = customerInvites.some(
          (i) => i.status === "pending" && new Date(i.expires_at) > new Date()
        );

        statusMap[id] = {
          customerId: id,
          hasPortalAccess: hasActiveLink,
          lastInviteSentAt: lastInvite?.sent_at ?? null,
          inviteCount: customerInvites.length,
          pendingInvite: hasPendingInvite && !hasActiveLink,
        };
      }

      return statusMap;
    },
    enabled: customerIds.length > 0,
    staleTime: 30000,
  });
}

export function useSingleCustomerPortalStatus(customerId: string | undefined) {
  return useQuery({
    queryKey: ["customer-portal-status-single", customerId],
    queryFn: async () => {
      if (!customerId) return null;

      // Fetch account link
      const { data: link } = await supabase
        .from("customer_account_links")
        .select("customer_account_id, status")
        .eq("customer_id", customerId)
        .eq("status", "active")
        .maybeSingle();

      // Fetch customer account details if linked
      let accountEmail: string | null = null;
      let lastLogin: string | null = null;
      
      if (link?.customer_account_id) {
        const { data: account } = await supabase
          .from("customer_accounts")
          .select("email, last_login_at")
          .eq("id", link.customer_account_id)
          .single();
        
        accountEmail = account?.email ?? null;
        lastLogin = account?.last_login_at ?? null;
      }

      // Fetch invites
      const { data: invites } = await supabase
        .from("customer_portal_invites")
        .select("sent_at, status, expires_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      const lastInvite = invites?.[0];
      const hasPendingInvite = invites?.some(
        (i) => i.status === "pending" && new Date(i.expires_at) > new Date()
      ) ?? false;

      return {
        customerId,
        hasPortalAccess: !!link,
        accountEmail,
        lastLogin,
        lastInviteSentAt: lastInvite?.sent_at ?? null,
        inviteCount: invites?.length ?? 0,
        pendingInvite: hasPendingInvite && !link,
      };
    },
    enabled: !!customerId,
  });
}
