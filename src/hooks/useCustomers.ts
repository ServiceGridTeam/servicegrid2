import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

export type Customer = Tables<"customers">;
export type CustomerInsert = TablesInsert<"customers">;
export type CustomerUpdate = TablesUpdate<"customers">;

export function useCustomers(options?: {
  search?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ["customers", options],
    queryFn: async () => {
      let query = supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (options?.search) {
        const searchTerm = `%${options.search}%`;
        query = query.or(
          `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},company_name.ilike.${searchTerm},phone.ilike.${searchTerm}`
        );
      }

      if (options?.status && options.status !== "all") {
        query = query.eq("lead_status", options.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Customer | null;
    },
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (customer: Omit<CustomerInsert, "business_id">) => {
      // Get the user's business_id
      const { data: businessId, error: businessError } = await supabase
        .rpc("get_user_business_id");
      
      if (businessError) throw businessError;
      if (!businessId) throw new Error("No business found for user");

      const { data, error } = await supabase
        .from("customers")
        .insert({ ...customer, business_id: businessId })
        .select()
        .single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({
        title: "Customer created",
        description: "The customer has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: CustomerUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", data.id] });
      toast({
        title: "Customer updated",
        description: "The customer has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({
        title: "Customer deleted",
        description: "The customer has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting customer",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useQualifyLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("customers")
        .update({ lead_status: "qualified" })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", data.id] });
      toast({
        title: "Lead qualified",
        description: "The lead has been marked as qualified.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error qualifying lead",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
