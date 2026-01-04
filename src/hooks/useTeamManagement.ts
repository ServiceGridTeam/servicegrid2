import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface TeamMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
  created_at: string;
  role: AppRole;
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

// Fetch team members for the current business
export function useTeamMembers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["team-members"],
    queryFn: async (): Promise<TeamMember[]> => {
      // First get the current user's business_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", user?.id)
        .single();

      if (!profile?.business_id) {
        return [];
      }

      // Get all profiles in this business with their roles
      const { data: members, error } = await supabase
        .from("profiles")
        .select(`
          id,
          first_name,
          last_name,
          email,
          avatar_url,
          job_title,
          created_at
        `)
        .eq("business_id", profile.business_id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Get roles for all members
      const memberIds = members?.map((m) => m.id) || [];
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", memberIds);

      if (rolesError) throw rolesError;

      // Merge roles with members
      const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]));
      
      return (members || []).map((member) => ({
        ...member,
        role: roleMap.get(member.id) || "viewer",
      }));
    },
    enabled: !!user,
  });
}

// Fetch pending invites for the current business
export function useTeamInvites() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["team-invites"],
    queryFn: async (): Promise<TeamInvite[]> => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", user?.id)
        .single();

      if (!profile?.business_id) {
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
        .eq("business_id", profile.business_id)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((invite: any) => ({
        ...invite,
        inviter: invite.inviter,
      }));
    },
    enabled: !!user,
  });
}

// Check if current user has permission to manage team
export function useCanManageTeam() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["can-manage-team"],
    queryFn: async (): Promise<boolean> => {
      if (!user) return false;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!roles || roles.length === 0) return false;

      return roles.some((r) => r.role === "owner" || r.role === "admin");
    },
    enabled: !!user,
  });
}

// Invite a new team member
export function useInviteTeamMember() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      // Get current user's business_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", user?.id)
        .single();

      if (!profile?.business_id) {
        throw new Error("No business found");
      }

      // Check if email is already a member
      const { data: existingMember } = await supabase
        .from("profiles")
        .select("id")
        .eq("business_id", profile.business_id)
        .eq("email", email)
        .maybeSingle();

      if (existingMember) {
        throw new Error("This person is already a team member");
      }

      // Create the invite
      const { data: invite, error: inviteError } = await supabase
        .from("team_invites")
        .insert({
          business_id: profile.business_id,
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

// Update a team member's role
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      newRole,
    }: {
      userId: string;
      newRole: AppRole;
    }) => {
      // Delete existing role and insert new one
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
  });
}

// Remove a team member from the business
export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      // Remove from business
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ business_id: null })
        .eq("id", userId);

      if (profileError) throw profileError;

      // Remove roles
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (roleError) throw roleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["business"] });
    },
  });
}
