import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PortalAuditEvent {
  id: string;
  customer_id: string;
  business_id: string;
  customer_account_id: string | null;
  event_type: string;
  event_details: Record<string, unknown>;
  performed_by: string | null;
  performer_name?: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export function usePortalAccessAudit(customerId: string | undefined) {
  return useQuery({
    queryKey: ["portal-access-audit", customerId],
    queryFn: async () => {
      if (!customerId) return [];

      const { data: events, error } = await supabase
        .from("portal_access_audit")
        .select(`
          id,
          customer_id,
          business_id,
          customer_account_id,
          event_type,
          event_details,
          performed_by,
          ip_address,
          user_agent,
          created_at
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch performer names for events with performed_by
      const performerIds = [...new Set(
        events?.map((e) => e.performed_by).filter(Boolean) as string[]
      )];

      let performerMap: Record<string, string> = {};
      if (performerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", performerIds);

        if (profiles) {
          performerMap = profiles.reduce((acc, p) => {
            acc[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return (events ?? []).map((event) => ({
        ...event,
        event_details: event.event_details as Record<string, unknown>,
        performer_name: event.performed_by ? performerMap[event.performed_by] : undefined,
      })) as PortalAuditEvent[];
    },
    enabled: !!customerId,
  });
}
