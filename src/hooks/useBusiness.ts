import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { Json } from "@/integrations/supabase/types";

export interface Business {
  id: string;
  name: string;
  slug: string | null;
  industry: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  timezone: string;
  logo_url: string | null;
  settings: Json;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  default_geofence_radius_meters: number | null;
  geofence_enforcement_mode: string | null;
  geofence_allow_override: boolean | null;
  geofence_override_requires_reason: boolean | null;
  geofence_override_requires_photo: boolean | null;
  created_at: string;
  updated_at: string;
}

export function useBusiness() {
  const { data: profile } = useProfile();

  return useQuery({
    queryKey: ["business", profile?.business_id],
    queryFn: async (): Promise<Business | null> => {
      if (!profile?.business_id) return null;

      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", profile.business_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.business_id,
  });
}

export function useCreateBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (businessData: { name: string; industry?: string; phone?: string; email?: string }) => {
      const { data, error } = await supabase
        .from("businesses")
        .insert({
          name: businessData.name,
          industry: businessData.industry ?? null,
          phone: businessData.phone ?? null,
          email: businessData.email ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business"] });
    },
  });
}

export function useUpdateBusiness() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: {
      name?: string;
      industry?: string;
      phone?: string;
      email?: string;
      website?: string;
      address_line1?: string;
      address_line2?: string;
      city?: string;
      state?: string;
      zip?: string;
      timezone?: string;
      logo_url?: string;
      settings?: Json;
      default_geofence_radius_meters?: number;
      geofence_enforcement_mode?: string;
      geofence_allow_override?: boolean;
      geofence_override_requires_reason?: boolean;
      geofence_override_requires_photo?: boolean;
    }) => {
      if (!profile?.business_id) throw new Error("No business associated");

      const { data, error } = await supabase
        .from("businesses")
        .update(updates)
        .eq("id", profile.business_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", profile?.business_id] });
    },
  });
}

export function useSetupBusiness() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (businessData: { 
      name: string; 
      industry?: string; 
      phone?: string; 
      email?: string;
    }) => {
      const { data, error } = await supabase.rpc('setup_business_for_user', {
        _name: businessData.name,
        _industry: businessData.industry ?? null,
        _phone: businessData.phone ?? null,
        _email: businessData.email ?? null,
      });

      if (error) throw error;
      return data as string;
    },
    onSuccess: (businessId) => {
      queryClient.invalidateQueries({ queryKey: ["business", businessId] });
      // Use exact profile key for invalidation
      if (profile?.id) {
        queryClient.invalidateQueries({ queryKey: ["profile", profile.id] });
      }
    },
  });
}