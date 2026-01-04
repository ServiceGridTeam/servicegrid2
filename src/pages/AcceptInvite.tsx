import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useInviteByToken, useAcceptInvite } from "@/hooks/useTeamManagement";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertCircle, Building2, Crown, Shield, Wrench, Eye } from "lucide-react";
import { z } from "zod";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const roleLabels: Record<AppRole, { label: string; icon: React.ReactNode }> = {
  owner: { label: "Owner", icon: <Crown className="h-4 w-4" /> },
  admin: { label: "Admin", icon: <Shield className="h-4 w-4" /> },
  technician: { label: "Technician", icon: <Wrench className="h-4 w-4" /> },
  viewer: { label: "Viewer", icon: <Eye className="h-4 w-4" /> },
};

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  const { toast } = useToast();
  
  const { data: invite, isLoading: inviteLoading, error: inviteError } = useInviteByToken(token);
  const acceptInvite = useAcceptInvite();
  
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedSuccessfully, setAcceptedSuccessfully] = useState(false);

  // If user is already logged in and belongs to a business, redirect
  useEffect(() => {
    const checkExistingBusiness = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("business_id")
          .eq("id", user.id)
          .single();
        
        if (profile?.business_id) {
          toast({
            variant: "destructive",
            title: "Already part of a business",
            description: "You are already a member of a business. Sign out first to accept this invite.",
          });
          navigate("/dashboard");
        }
      }
    };
    
    checkExistingBusiness();
  }, [user, navigate, toast]);

  // Pre-fill email from invite
  useEffect(() => {
    if (invite?.email) {
      setEmail(invite.email);
    }
  }, [invite]);

  // Auto-accept invite if user is logged in and invite matches their email
  useEffect(() => {
    const autoAccept = async () => {
      if (user && invite && token && !acceptedSuccessfully) {
        // Check if logged-in user's email matches invite email
        const { data: session } = await supabase.auth.getSession();
        if (session.session?.user.email?.toLowerCase() === invite.email.toLowerCase()) {
          await handleAcceptInvite();
        }
      }
    };
    
    autoAccept();
  }, [user, invite, token]);

  const handleAcceptInvite = async () => {
    if (!token) return;
    
    try {
      await acceptInvite.mutateAsync(token);
      setAcceptedSuccessfully(true);
      toast({
        title: "Welcome to the team!",
        description: `You've joined ${(invite as any)?.business?.name || "the business"}`,
      });
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to accept invite",
        description: error.message,
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);

      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/invite/${token}`,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          },
        },
      });

      if (error) throw error;

      // After signup, accept the invite
      // Note: User needs to verify email first in production
      toast({
        title: "Account created",
        description: "Accepting your invitation...",
      });
      
      // Try to accept immediately (works if email auto-confirm is on)
      setTimeout(handleAcceptInvite, 1000);
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      emailSchema.parse(email);
      
      const { error } = await signIn(email.trim().toLowerCase(), password);
      if (error) throw error;

      // After signin, accept the invite
      toast({
        title: "Signed in",
        description: "Accepting your invitation...",
      });
      
      setTimeout(handleAcceptInvite, 1000);
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (inviteLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error or expired/invalid invite
  if (inviteError || !invite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground text-center mb-6">
              This invitation link is invalid or has expired.
            </p>
            <Button onClick={() => navigate("/auth")} variant="outline">
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if invite expired
  if (new Date(invite.expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation Expired</h2>
            <p className="text-muted-foreground text-center mb-6">
              This invitation has expired. Please ask for a new invitation.
            </p>
            <Button onClick={() => navigate("/auth")} variant="outline">
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (acceptedSuccessfully) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Welcome to the team!</h2>
            <p className="text-muted-foreground text-center mb-6">
              You've successfully joined {(invite as any)?.business?.name}
            </p>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">Redirecting to dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleConfig = roleLabels[invite.role];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">You're Invited!</CardTitle>
          <CardDescription className="space-y-2">
            <span className="block">
              Join <strong>{(invite as any)?.business?.name || "the team"}</strong> on ServiceGrid
            </span>
            <Badge variant="secondary" className="gap-1">
              {roleConfig.icon}
              {roleConfig.label}
            </Badge>
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {user ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  You're signed in as <strong>{user.email}</strong>
                </AlertDescription>
              </Alert>
              <Button
                onClick={handleAcceptInvite}
                disabled={acceptInvite.isPending}
                className="w-full"
              >
                {acceptInvite.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Accept Invitation
              </Button>
            </div>
          ) : (
            <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signup">Create Account</TabsTrigger>
                <TabsTrigger value="signin">Sign In</TabsTrigger>
              </TabsList>

              <TabsContent value="signup" className="mt-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First name</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last name</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                    />
                  </div>
                  
                  {formError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{formError}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account & Join
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signin" className="mt-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signInEmail">Email</Label>
                    <Input
                      id="signInEmail"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signInPassword">Password</Label>
                    <Input
                      id="signInPassword"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  {formError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{formError}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In & Join
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
