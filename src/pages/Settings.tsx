import { useState } from "react";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useBusiness, useUpdateBusiness } from "@/hooks/useBusiness";
import { useStripeConnectStatus, useStripeConnectOnboard } from "@/hooks/useStripeConnect";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Building2, Bell, CreditCard, CheckCircle, AlertCircle, ExternalLink, Users, Puzzle, Mail } from "lucide-react";
import { TeamManagement } from "@/components/settings/TeamManagement";
import { GoogleMapsVerificationCard } from "@/components/settings/GoogleMapsVerificationCard";
import { GeofenceSettingsCard } from "@/components/settings/GeofenceSettingsCard";
import { NotificationPreferencesCard } from "@/components/settings/NotificationPreferencesCard";
import { PhoneIntegrationCard } from "@/components/settings/PhoneIntegrationCard";
import { PhoneSettingsForm } from "@/components/settings/PhoneSettingsForm";
import { EmailBrandingCard } from "@/components/settings/EmailBrandingCard";
import { PhotoSettingsCard } from "@/components/settings/PhotoSettingsCard";
import { EmailConnectionCard, EmailRulesManager } from "@/components/email";
import { useEmailConnections } from "@/hooks/useEmailConnections";

export default function Settings() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: business, isLoading: businessLoading } = useBusiness();
  const { data: stripeStatus, isLoading: stripeLoading, refetch: refetchStripe } = useStripeConnectStatus();
  const updateProfile = useUpdateProfile();
  const updateBusiness = useUpdateBusiness();
  const stripeOnboard = useStripeConnectOnboard();
  const { signOut } = useAuth();
  const { toast } = useToast();

  const [profileData, setProfileData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    job_title: "",
  });

  const [businessData, setBusinessData] = useState({
    name: "",
    phone: "",
    email: "",
    website: "",
    address_line1: "",
    city: "",
    state: "",
    zip: "",
  });

  // Initialize form data when profile/business loads
  useState(() => {
    if (profile) {
      setProfileData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        phone: profile.phone || "",
        job_title: profile.job_title || "",
      });
    }
    if (business) {
      setBusinessData({
        name: business.name || "",
        phone: business.phone || "",
        email: business.email || "",
        website: business.website || "",
        address_line1: business.address_line1 || "",
        city: business.city || "",
        state: business.state || "",
        zip: business.zip || "",
      });
    }
  });

  const handleProfileSave = async () => {
    try {
      await updateProfile.mutateAsync(profileData);
      toast({ title: "Profile updated successfully" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to update profile",
        description: error.message,
      });
    }
  };

  const handleBusinessSave = async () => {
    try {
      await updateBusiness.mutateAsync(businessData);
      toast({ title: "Business settings updated successfully" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to update business",
        description: error.message,
      });
    }
  };
  const handleStripeConnect = async () => {
    try {
      const return_url = `${window.location.origin}/stripe/return`;
      const result = await stripeOnboard.mutateAsync({ return_url });
      window.location.href = result.url;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to start Stripe setup",
        description: error.message,
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and business settings
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="h-4 w-4" />
            Business
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Puzzle className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First name</Label>
                  <Input
                    id="first_name"
                    value={profileData.first_name}
                    onChange={(e) =>
                      setProfileData({ ...profileData, first_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input
                    id="last_name"
                    value={profileData.last_name}
                    onChange={(e) =>
                      setProfileData({ ...profileData, last_name: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) =>
                    setProfileData({ ...profileData, phone: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job_title">Job title</Label>
                <Input
                  id="job_title"
                  value={profileData.job_title}
                  onChange={(e) =>
                    setProfileData({ ...profileData, job_title: e.target.value })
                  }
                />
              </div>

              <Button onClick={handleProfileSave} disabled={updateProfile.isPending}>
                {updateProfile.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions for your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={signOut}>
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <TeamManagement />
        </TabsContent>

        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>
                Update your business details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business_name">Business name</Label>
                <Input
                  id="business_name"
                  value={businessData.name}
                  onChange={(e) =>
                    setBusinessData({ ...businessData, name: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business_phone">Phone</Label>
                  <Input
                    id="business_phone"
                    type="tel"
                    value={businessData.phone}
                    onChange={(e) =>
                      setBusinessData({ ...businessData, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business_email">Email</Label>
                  <Input
                    id="business_email"
                    type="email"
                    value={businessData.email}
                    onChange={(e) =>
                      setBusinessData({ ...businessData, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://"
                  value={businessData.website}
                  onChange={(e) =>
                    setBusinessData({ ...businessData, website: e.target.value })
                  }
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={businessData.address_line1}
                  onChange={(e) =>
                    setBusinessData({ ...businessData, address_line1: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={businessData.city}
                    onChange={(e) =>
                      setBusinessData({ ...businessData, city: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={businessData.state}
                    onChange={(e) =>
                      setBusinessData({ ...businessData, state: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP</Label>
                  <Input
                    id="zip"
                    value={businessData.zip}
                    onChange={(e) =>
                      setBusinessData({ ...businessData, zip: e.target.value })
                    }
                  />
                </div>
              </div>

              <Button onClick={handleBusinessSave} disabled={updateBusiness.isPending}>
                {updateBusiness.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </CardContent>
          </Card>
          
          <EmailBrandingCard />
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Processing</CardTitle>
              <CardDescription>
                Connect with Stripe to accept online payments on invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stripeLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground">Loading payment status...</span>
                </div>
              ) : stripeStatus?.onboarding_complete ? (
                <div className="space-y-4">
                  <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      Stripe is connected and ready to accept payments!
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Payment Status</p>
                      <p className="text-sm text-muted-foreground">
                        {stripeStatus.charges_enabled ? "Accepting payments" : "Payments restricted"}
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Payout Status</p>
                      <p className="text-sm text-muted-foreground">
                        {stripeStatus.payouts_enabled ? "Payouts enabled" : "Payouts pending"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleStripeConnect}
                    disabled={stripeOnboard.isPending}
                  >
                    {stripeOnboard.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Stripe Dashboard
                  </Button>
                </div>
              ) : stripeStatus?.status === "restricted" || stripeStatus?.status === "pending" ? (
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Your Stripe account setup is incomplete. Please finish the verification process.
                    </AlertDescription>
                  </Alert>
                  <Button
                    onClick={handleStripeConnect}
                    disabled={stripeOnboard.isPending}
                  >
                    {stripeOnboard.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Complete Stripe Setup
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Connect your Stripe account to start accepting credit card payments directly on your invoices.
                    Customers will be able to pay securely with Stripe Checkout.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Accept all major credit cards
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Secure payment processing
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Automatic invoice status updates
                    </li>
                  </ul>
                  <Button
                    onClick={handleStripeConnect}
                    disabled={stripeOnboard.isPending}
                    className="gap-2"
                  >
                    {stripeOnboard.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Connect with Stripe
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-1">External Integrations</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Verify and manage connections to third-party services
            </p>
          </div>
          <GoogleMapsVerificationCard />
          
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-1">Phone Integration</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Connect the SG Phone AI Receptionist to your business
            </p>
          </div>
          <PhoneIntegrationCard />
          <PhoneSettingsForm />
          
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-1">Email Integration</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Connect Gmail to automatically create job requests from customer emails
            </p>
          </div>
          <EmailConnectionCard />
          
          <div className="mt-4">
            <EmailRulesManager />
          </div>
          
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-1">Field Operations</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Configure location-based features for your team
            </p>
          </div>
          <GeofenceSettingsCard />
          
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-1">Photo & Media</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Configure photo and video capture settings for field staff
            </p>
          </div>
          <PhotoSettingsCard />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationPreferencesCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}