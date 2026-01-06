import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PortalInvite {
  id: string;
  email: string;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  created_by: string | null;
  created_by_name?: string;
}

export function usePortalInviteHistory(customerId: string | undefined) {
  return useQuery({
    queryKey: ["portal-invite-history", customerId],
    queryFn: async () => {
      if (!customerId) return [];

      const { data: invites, error } = await supabase
        .from("customer_portal_invites")
        .select(`
          id,
          email,
          status,
          sent_at,
          accepted_at,
          expires_at,
          created_at,
          created_by
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch creator names
      const creatorIds = [...new Set(invites?.map((i) => i.created_by).filter(Boolean) as string[])];
      
      let creatorMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", creatorIds);

        if (profiles) {
          creatorMap = profiles.reduce((acc, p) => {
            acc[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return (invites ?? []).map((invite) => ({
        ...invite,
        created_by_name: invite.created_by ? creatorMap[invite.created_by] : undefined,
      })) as PortalInvite[];
    },
    enabled: !!customerId,
  });
}
