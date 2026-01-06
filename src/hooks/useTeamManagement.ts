import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessContext } from "@/hooks/useBusinessContext";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface TeamMember {
  id: string;
  membershipId: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
  created_at: string;
  role: AppRole;
  status: string;
  isPrimary: boolean;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: AppRole;
  token: string;
  expires_at: string;
  created_at: string;
  invited_by: string;
  inviter?: {
    first_name: string | null;
    last_name: string | null;
  };
}

// Fetch team members for the current business using business_memberships
export function useTeamMembers() {
  const { user } = useAuth();
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ["team-members", activeBusinessId],
    queryFn: async (): Promise<TeamMember[]> => {
      if (!activeBusinessId) {
        return [];
      }

      // Get all memberships for this business with profile info
      const { data: memberships, error } = await supabase
        .from("business_memberships")
        .select(`
          id,
          user_id,
          role,
          status,
          is_primary,
          joined_at,
          profiles (
            id,
            first_name,
            last_name,
            email,
            avatar_url,
            job_title,
            created_at
          )
        `)
        .eq("business_id", activeBusinessId)
        .eq("status", "active")
        .order("joined_at", { ascending: true });

      if (error) throw error;

      return (memberships || []).map((m: any) => ({
        id: m.profiles?.id || m.user_id,
        membershipId: m.id,
        first_name: m.profiles?.first_name || null,
        last_name: m.profiles?.last_name || null,
        email: m.profiles?.email || null,
        avatar_url: m.profiles?.avatar_url || null,
        job_title: m.profiles?.job_title || null,
        created_at: m.profiles?.created_at || m.joined_at,
        role: m.role,
        status: m.status,
        isPrimary: m.is_primary,
      }));
    },
    enabled: !!user && !!activeBusinessId,
  });
}

// Fetch pending invites for the current business
export function useTeamInvites() {
  const { user } = useAuth();
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ["team-invites", activeBusinessId],
    queryFn: async (): Promise<TeamInvite[]> => {
      if (!activeBusinessId) {
        return [];
      }

      const { data, error } = await supabase
        .from("team_invites")
        .select(`
          id,
          email,
          role,
          token,
          expires_at,
          created_at,
          invited_by,
          inviter:profiles!invited_by(first_name, last_name)
        `)
        .eq("business_id", activeBusinessId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((invite: any) => ({
        ...invite,
        inviter: invite.inviter,
      }));
    },
    enabled: !!user && !!activeBusinessId,
  });
}

// Check if current user has permission to manage team
export function useCanManageTeam() {
  const { activeRole } = useBusinessContext();

  return useQuery({
    queryKey: ["can-manage-team", activeRole],
    queryFn: async (): Promise<boolean> => {
      return activeRole === "owner" || activeRole === "admin";
    },
    enabled: !!activeRole,
  });
}

// Invite a new team member
export function useInviteTeamMember() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeBusinessId } = useBusinessContext();

  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      if (!activeBusinessId) {
        throw new Error("No business selected");
      }

      // Check if email is already a member via business_memberships
      const { data: existingMembership } = await supabase
        .from("business_memberships")
        .select("id")
        .eq("business_id", activeBusinessId)
        .eq("status", "active")
        .maybeSingle();

      // Get profile by email to check membership
      const { data: profileByEmail } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (profileByEmail) {
        const { data: existingMember } = await supabase
          .from("business_memberships")
          .select("id, status")
          .eq("business_id", activeBusinessId)
          .eq("user_id", profileByEmail.id)
          .maybeSingle();

        if (existingMember?.status === "active") {
          throw new Error("This person is already a team member");
        }
      }

      // Create the invite
      const { data: invite, error: inviteError } = await supabase
        .from("team_invites")
        .insert({
          business_id: activeBusinessId,
          email,
          role,
          invited_by: user?.id,
        })
        .select()
        .single();

      if (inviteError) {
        if (inviteError.code === "23505") {
          throw new Error("An invite has already been sent to this email");
        }
        throw inviteError;
      }

      // Send invite email
      const { error: emailError } = await supabase.functions.invoke(
        "send-team-invite-email",
        {
          body: { invite_id: invite.id },
        }
      );

      if (emailError) {
        console.error("Failed to send invite email:", emailError);
        // Don't throw - invite was created successfully
      }

      return invite;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-invites"] });
    },
  });
}

// Cancel a pending invite
export function useCancelInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("team_invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-invites"] });
    },
  });
}

// Update a team member's role using edge function
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      membershipId,
      newRole,
    }: {
      membershipId: string;
      newRole: AppRole;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "membership-management",
        {
          body: {
            action: "change-role",
            membershipId,
            newRole,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["business-memberships"] });
    },
  });
}

// Remove a team member from the business using edge function
export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (membershipId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "membership-management",
        {
          body: {
            action: "remove",
            membershipId,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["business-memberships"] });
    },
  });
}

// Get invite by token (public)
export function useInviteByToken(token: string | undefined) {
  return useQuery({
    queryKey: ["invite", token],
    queryFn: async () => {
      if (!token) return null;

      const { data, error } = await supabase
        .from("team_invites")
        .select(`
          id,
          email,
          role,
          expires_at,
          business:businesses(id, name)
        `)
        .eq("token", token)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });
}

// Accept an invite
export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc("accept_team_invite", {
        _token: token,
      });

      if (error) throw error;
      return data as { success: boolean; business_id: string; role: string };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["business"] });
      queryClient.invalidateQueries({ queryKey: ["business-memberships"] });

      // Notify team about new member
      if (data?.success && data.business_id) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.functions.invoke("notify-team-member-joined", {
            body: {
              userId: user?.id,
              businessId: data.business_id,
              role: data.role,
            },
          });
        } catch (err) {
          console.error("Failed to send team member joined notification:", err);
        }
      }
    },
  });
}

// Suspend a member
export function useSuspendMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ membershipId, reason }: { membershipId: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "membership-management",
        {
          body: {
            action: "suspend",
            membershipId,
            reason,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["business-memberships"] });
    },
  });
}

// Reactivate a suspended member
export function useReactivateMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ membershipId, reason }: { membershipId: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "membership-management",
        {
          body: {
            action: "reactivate",
            membershipId,
            reason,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["business-memberships"] });
    },
  });
}

// Transfer ownership
export function useTransferOwnership() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();

  return useMutation({
    mutationFn: async ({ targetUserId, reason }: { targetUserId: string; reason?: string }) => {
      if (!activeBusinessId) throw new Error("No business selected");

      const { data, error } = await supabase.functions.invoke(
        "membership-management",
        {
          body: {
            action: "transfer-ownership",
            targetUserId,
            targetBusinessId: activeBusinessId,
            reason,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["business-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// Leave a business
export function useLeaveBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ targetBusinessId, reason }: { targetBusinessId: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "membership-management",
        {
          body: {
            action: "leave",
            targetBusinessId,
            reason,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// Set primary business
export function useSetPrimaryBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetBusinessId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "membership-management",
        {
          body: {
            action: "set-primary",
            targetBusinessId,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-memberships"] });
    },
  });
}
