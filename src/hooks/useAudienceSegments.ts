import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type AudienceSegment = Database["public"]["Tables"]["audience_segments"]["Row"];
type AudienceSegmentInsert = Database["public"]["Tables"]["audience_segments"]["Insert"];

export interface FilterConfig {
  tags?: string[];
  lead_status?: string[];
  email_status?: string[];
  source?: string[];
  cities?: string[];
  states?: string[];
  created_after?: string;
  created_before?: string;
  has_email?: boolean;
  exclude_unsubscribed?: boolean;
}

export function useAudienceSegments() {
  return useQuery({
    queryKey: ["audience-segments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audience_segments")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });
}

export function useAudienceSegment(id: string | undefined) {
  return useQuery({
    queryKey: ["audience-segments", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("audience_segments")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateAudienceSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (segment: Omit<AudienceSegmentInsert, "business_id">) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .single();

      if (!profile?.business_id) throw new Error("No business found");

      const { data, error } = await supabase
        .from("audience_segments")
        .insert({
          ...segment,
          business_id: profile.business_id,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audience-segments"] });
    },
  });
}

export function useUpdateAudienceSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AudienceSegment> & { id: string }) => {
      const { data, error } = await supabase
        .from("audience_segments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audience-segments"] });
    },
  });
}

export function useDeleteAudienceSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("audience_segments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audience-segments"] });
    },
  });
}

export function useAudiencePreview(filterConfig: FilterConfig | null) {
  return useQuery({
    queryKey: ["audience-preview", filterConfig],
    queryFn: async () => {
      if (!filterConfig) return { count: 0, sample: [] };

      let query = supabase.from("customers").select("id, first_name, last_name, email, tags, lead_status");

      // Apply filters
      if (filterConfig.tags && filterConfig.tags.length > 0) {
        query = query.overlaps("tags", filterConfig.tags);
      }

      if (filterConfig.lead_status && filterConfig.lead_status.length > 0) {
        query = query.in("lead_status", filterConfig.lead_status);
      }

      if (filterConfig.email_status && filterConfig.email_status.length > 0) {
        query = query.in("email_status", filterConfig.email_status);
      }

      if (filterConfig.source && filterConfig.source.length > 0) {
        query = query.in("source", filterConfig.source);
      }

      if (filterConfig.cities && filterConfig.cities.length > 0) {
        query = query.in("city", filterConfig.cities);
      }

      if (filterConfig.states && filterConfig.states.length > 0) {
        query = query.in("state", filterConfig.states);
      }

      if (filterConfig.created_after) {
        query = query.gte("created_at", filterConfig.created_after);
      }

      if (filterConfig.created_before) {
        query = query.lte("created_at", filterConfig.created_before);
      }

      if (filterConfig.has_email) {
        query = query.not("email", "is", null);
      }

      if (filterConfig.exclude_unsubscribed !== false) {
        query = query.or("email_status.is.null,email_status.neq.unsubscribed");
      }

      const { data, error, count } = await query.limit(5);

      if (error) throw error;

      // Get total count with a separate query
      let countQuery = supabase.from("customers").select("id", { count: "exact", head: true });

      // Apply same filters for count
      if (filterConfig.tags && filterConfig.tags.length > 0) {
        countQuery = countQuery.overlaps("tags", filterConfig.tags);
      }
      if (filterConfig.lead_status && filterConfig.lead_status.length > 0) {
        countQuery = countQuery.in("lead_status", filterConfig.lead_status);
      }
      if (filterConfig.email_status && filterConfig.email_status.length > 0) {
        countQuery = countQuery.in("email_status", filterConfig.email_status);
      }
      if (filterConfig.source && filterConfig.source.length > 0) {
        countQuery = countQuery.in("source", filterConfig.source);
      }
      if (filterConfig.cities && filterConfig.cities.length > 0) {
        countQuery = countQuery.in("city", filterConfig.cities);
      }
      if (filterConfig.states && filterConfig.states.length > 0) {
        countQuery = countQuery.in("state", filterConfig.states);
      }
      if (filterConfig.created_after) {
        countQuery = countQuery.gte("created_at", filterConfig.created_after);
      }
      if (filterConfig.created_before) {
        countQuery = countQuery.lte("created_at", filterConfig.created_before);
      }
      if (filterConfig.has_email) {
        countQuery = countQuery.not("email", "is", null);
      }
      if (filterConfig.exclude_unsubscribed !== false) {
        countQuery = countQuery.or("email_status.is.null,email_status.neq.unsubscribed");
      }

      const { count: totalCount } = await countQuery;

      return {
        count: totalCount || 0,
        sample: data || [],
      };
    },
    enabled: !!filterConfig,
  });
}

// Helper to get unique values for filter options
export function useCustomerFilterOptions() {
  return useQuery({
    queryKey: ["customer-filter-options"],
    queryFn: async () => {
      const { data: customers, error } = await supabase
        .from("customers")
        .select("tags, lead_status, source, city, state, email_status");

      if (error) throw error;

      const tags = new Set<string>();
      const leadStatuses = new Set<string>();
      const sources = new Set<string>();
      const cities = new Set<string>();
      const states = new Set<string>();
      const emailStatuses = new Set<string>();

      customers?.forEach((c) => {
        if (c.tags) c.tags.forEach((t) => tags.add(t));
        if (c.lead_status) leadStatuses.add(c.lead_status);
        if (c.source) sources.add(c.source);
        if (c.city) cities.add(c.city);
        if (c.state) states.add(c.state);
        if (c.email_status) emailStatuses.add(c.email_status);
      });

      return {
        tags: Array.from(tags).sort(),
        leadStatuses: Array.from(leadStatuses).sort(),
        sources: Array.from(sources).sort(),
        cities: Array.from(cities).sort(),
        states: Array.from(states).sort(),
        emailStatuses: Array.from(emailStatuses).sort(),
      };
    },
  });
}
