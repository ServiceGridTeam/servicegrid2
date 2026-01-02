import { useState } from "react";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useBusiness, useUpdateBusiness } from "@/hooks/useBusiness";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Building2, Bell, Shield } from "lucide-react";

export default function Settings() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: business, isLoading: businessLoading } = useBusiness();
  const updateProfile = useUpdateProfile();
  const updateBusiness = useUpdateBusiness();
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
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="h-4 w-4" />
            Business
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
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Notification settings coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}