import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessContext } from "./useBusinessContext";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type EmailClassification = "service_request" | "inquiry" | "spam" | "out_of_scope" | "unclassified";
export type EmailStatus = "new" | "processing" | "processed" | "spam" | "ignored" | "request_created";
export type ClassificationTier = "ai" | "rules" | "keywords";
export type ClassificationStage = "pending" | "analyzing" | "reading" | "extracting" | "complete" | "failed";

export interface InboundEmail {
  id: string;
  business_id: string;
  connection_id: string;
  provider_message_id: string;
  thread_id: string | null;
  from_address: string;
  from_name: string | null;
  to_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  classification: EmailClassification | null;
  classification_confidence: number | null;
  classification_tier: ClassificationTier | null;
  classification_stage: ClassificationStage;
  classified_at: string | null;
  ai_extracted_data: {
    service_type?: string;
    issue_description?: string;
    urgency?: string;
    address?: string;
    phone?: string;
    customer_name?: string;
  };
  content_hash: string;
  is_duplicate: boolean;
  duplicate_of_id: string | null;
  status: EmailStatus;
  job_request_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailFilters {
  classification?: EmailClassification | "all";
  status?: EmailStatus | "all";
  dateRange?: { from: Date; to: Date };
  search?: string;
  connectionId?: string;
}

export function useInboundEmails(filters: EmailFilters = {}) {
  const { activeBusinessId } = useBusinessContext();
  const businessId = activeBusinessId;

  return useQuery({
    queryKey: ["inbound-emails", businessId, filters],
    queryFn: async () => {
      if (!businessId) return [];

      let query = supabase
        .from("inbound_emails")
        .select("*")
        .eq("business_id", businessId)
        .order("received_at", { ascending: false })
        .limit(100);

      if (filters.classification && filters.classification !== "all") {
        query = query.eq("classification", filters.classification);
      }

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      if (filters.connectionId) {
        query = query.eq("connection_id", filters.connectionId);
      }

      if (filters.dateRange?.from) {
        query = query.gte("received_at", filters.dateRange.from.toISOString());
      }

      if (filters.dateRange?.to) {
        query = query.lte("received_at", filters.dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as InboundEmail[];
    },
    enabled: !!businessId,
  });
}

export function useInboundEmail(emailId: string | undefined) {
  return useQuery({
    queryKey: ["inbound-email", emailId],
    queryFn: async () => {
      if (!emailId) return null;

      const { data, error } = await supabase
        .from("inbound_emails")
        .select("*")
        .eq("id", emailId)
        .single();

      if (error) throw error;
      return data as InboundEmail;
    },
    enabled: !!emailId,
  });
}

// Local filtering for instant response
export function useFilteredEmails(emails: InboundEmail[], searchTerm: string) {
  return useMemo(() => {
    if (!searchTerm.trim()) return emails;

    const term = searchTerm.toLowerCase();
    return emails.filter(
      (email) =>
        email.subject?.toLowerCase().includes(term) ||
        email.from_address.toLowerCase().includes(term) ||
        email.from_name?.toLowerCase().includes(term) ||
        email.body_text?.toLowerCase().includes(term)
    );
  }, [emails, searchTerm]);
}

// Realtime subscription for classification stage updates
export function useEmailRealtimeUpdates() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();

  useEffect(() => {
    if (!activeBusinessId) return;

    const channel = supabase
      .channel("inbound-emails-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inbound_emails",
          filter: `business_id=eq.${activeBusinessId}`,
        },
        (payload) => {
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
          
          if (payload.new && typeof payload.new === "object" && "id" in payload.new) {
            queryClient.invalidateQueries({ 
              queryKey: ["inbound-email", payload.new.id] 
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBusinessId, queryClient]);
}

export function useUnprocessedEmailCount() {
  const { activeBusinessId } = useBusinessContext();
  const businessId = activeBusinessId;

  return useQuery({
    queryKey: ["unprocessed-email-count", businessId],
    queryFn: async () => {
      if (!businessId) return 0;

      const { count, error } = await supabase
        .from("inbound_emails")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .in("status", ["new", "processing"]);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!businessId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useClassifyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emailId: string) => {
      const { data, error } = await supabase.functions.invoke("classify-email", {
        body: { email_id: emailId },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, emailId) => {
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
      queryClient.invalidateQueries({ queryKey: ["inbound-email", emailId] });
      toast.success("Email reclassified");
    },
    onError: (error: Error) => {
      toast.error(`Classification failed: ${error.message}`);
    },
  });
}

export function useCreateRequestFromEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      emailId: string;
      overrideData?: {
        customer_name?: string;
        customer_phone?: string;
        service_type?: string;
        description?: string;
        urgency?: string;
        address?: {
          line1?: string;
          city?: string;
          state?: string;
          zip?: string;
        };
      };
    }) => {
      const { data, error } = await supabase.functions.invoke("email-to-request", {
        body: { 
          email_id: params.emailId,
          override_data: params.overrideData,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
      queryClient.invalidateQueries({ queryKey: ["job-requests"] });
      toast.success(`Request ${data.request_number} created`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create request: ${error.message}`);
    },
  });
}

export function useMarkEmailAsSpam() {
  const queryClient = useQueryClient();
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastMarkedId, setLastMarkedId] = useState<string | null>(null);

  const markAsSpam = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase
        .from("inbound_emails")
        .update({
          classification: "spam",
          status: "spam",
          updated_at: new Date().toISOString(),
        })
        .eq("id", emailId);

      if (error) throw error;
      return emailId;
    },
    onSuccess: (emailId) => {
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
      setLastMarkedId(emailId);

      // Clear any existing undo timeout
      if (undoTimeout) clearTimeout(undoTimeout);

      // Set up undo window
      const timeout = setTimeout(() => {
        setLastMarkedId(null);
      }, 7000);
      setUndoTimeout(timeout);

      toast.success("Marked as spam", {
        action: {
          label: "Undo",
          onClick: () => undoSpam(emailId),
        },
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to mark as spam: ${error.message}`);
    },
  });

  const undoSpam = async (emailId: string) => {
    if (undoTimeout) clearTimeout(undoTimeout);
    setLastMarkedId(null);

    const { error } = await supabase
      .from("inbound_emails")
      .update({
        classification: "unclassified",
        status: "new",
        updated_at: new Date().toISOString(),
      })
      .eq("id", emailId);

    if (error) {
      toast.error("Failed to undo");
    } else {
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
      toast.success("Spam marking undone");
    }
  };

  return { markAsSpam, undoSpam, lastMarkedId };
}
